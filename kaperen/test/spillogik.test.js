// Test af Kaperens spillogik (ingen browser): node kaperen/test/spillogik.test.js
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.KaperenLogik;
var n = 0;
function test(name, fn) { fn(); n++; console.log('OK  ' + name); }
function nyt(seed) { return L.createGame({ seed: seed === undefined ? 7 : seed }); }
// Et møde lige nu (rejse fra Tågeskær til Sølvbyen)
function medMoede(slags, seed, ber) {
  for (var s = seed || 1; s < 5000; s++) {
    var g = nyt(s); if (ber) g.state.beroemmelse = ber;
    g.state.proviant = 40;
    var r = g.sejl('soelvbyen');
    if (r && r.moede && r.moede.slags === slags) return g;
  }
  throw new Error('fandt intet ' + slags);
}

test('5 varer, 8 havne med navne, 4 skibe i stigende størrelse', function () {
  assert.strictEqual(L.VARER.length, 5);
  assert.strictEqual(L.HAVNE.length, 8);
  var ids = {};
  L.HAVNE.forEach(function (h) { assert.ok(h.navn && !ids[h.id] && /^[a-z]+$/.test(h.id), h.id); ids[h.id] = 1; assert.ok(h.billig.length && h.dyr.length); });
  for (var i = 1; i < L.SKIBE.length; i++) ['last', 'skrog', 'kanoner', 'mandskab', 'pris'].forEach(function (k) { assert.ok(L.SKIBE[i][k] > L.SKIBE[i - 1][k], k); });
});

test('ny rejse: slup i en havn, startguld, ingen rejse', function () {
  var g = nyt(), st = g.state;
  assert.strictEqual(st.skib, 'slup'); assert.strictEqual(st.guld, L.START.guld);
  assert.ok(L.havnById(st.havn)); assert.strictEqual(st.rejse, null); assert.strictEqual(st.over, null);
  assert.strictEqual(g.point(), g.formue() + 10 * st.beroemmelse);
});

test('samme seed giver samme spil; gemt tilstand kan genskabes', function () {
  var a = nyt(42), b = nyt(42);
  assert.deepStrictEqual(a.save(), b.save());
  a.sejl('ravnsoe'); var gemt = JSON.parse(JSON.stringify(a.save()));
  var c = L.createGame(gemt);
  assert.deepStrictEqual(c.save(), a.save());
});

test('billige varer er billige og dyre er dyre (alle havne)', function () {
  for (var s = 1; s < 20; s++) {
    var g = nyt(s);
    L.HAVNE.forEach(function (h) {
      h.billig.forEach(function (v) { assert.notStrictEqual(g.pris(v, h.id).niveau, 'dyr', h.id + v); });
      h.dyr.forEach(function (v) { assert.notStrictEqual(g.pris(v, h.id).niveau, 'billig', h.id + v); });
    });
  }
});

test('køb og salg: 1, 5 og alt; lastrum og guld begrænser', function () {
  var g = nyt(), st = g.state;
  var r = g.koeb('rom', 1); assert.ok(r.ok); assert.strictEqual(st.last.rom, 1);
  r = g.koeb('rom', 5); assert.ok(r.ok); assert.strictEqual(st.last.rom, 6);
  st.guld = 100000; r = g.koeb('sukker', 'alt'); assert.ok(r.ok); assert.strictEqual(g.fri(), 0); assert.strictEqual(r.grund, 'fuldt');
  assert.strictEqual(g.koeb('silke', 1).grund, 'fuldt');
  var foer = st.guld; r = g.saelg('rom', 'alt'); assert.ok(r.ok); assert.strictEqual(st.last.rom, 0); assert.ok(st.guld > foer);
  assert.strictEqual(g.saelg('rom', 1).grund, 'ingen');
  st.guld = 0; assert.strictEqual(g.koeb('rom', 1).grund, 'guld');
  assert.ok(g.pris('rom').salg < g.pris('rom').koeb, 'salgspris under købspris');
});

test('man kan ikke handle eller bruge værftet til søs', function () {
  var g = nyt(); g.sejl('kongshavn');
  assert.strictEqual(g.koeb('rom', 1).ok, false);
  assert.strictEqual(g.reparer('alt').ok, false);
  assert.strictEqual(g.gaaILand(), null);
});

test('værft: reparation, kanoner, sejl, lastrum og større skib', function () {
  var g = nyt(), st = g.state; st.guld = 100000;
  st.skrog -= 10; var r = g.reparer('alt'); assert.ok(r.ok); assert.strictEqual(st.skrog, g.maxSkrog()); assert.strictEqual(r.pris, 10 * L.REPARATION);
  assert.strictEqual(g.reparer('alt').grund, 'helt');
  while (g.kanonPris() !== null) assert.ok(g.koebKanon().ok);
  assert.strictEqual(st.kanoner, g.type().kanoner); assert.strictEqual(g.koebKanon().grund, 'max');
  var f = g.fart(); assert.ok(g.opgrader('sejl').ok); assert.strictEqual(g.fart(), f + 1);
  var l = g.lastrum(); assert.ok(g.opgrader('lastrum').ok); assert.ok(g.lastrum() > l);
  var typer = ['slup'];
  while (g.naesteSkib()) { var ns = g.naesteSkib(); r = g.koebSkib(); assert.ok(r.ok); typer.push(st.skib); assert.strictEqual(st.skrog, g.maxSkrog()); }
  assert.deepStrictEqual(typer, L.SKIBE.map(function (s) { return s.id; }));
  assert.strictEqual(g.koebSkib().grund, 'max');
});

test('værtshus: hyr mandskab og proviant (5 og fyld/alt)', function () {
  var g = nyt(), st = g.state; st.guld = 100000;
  var r = g.hyr(5); assert.ok(r.ok); assert.strictEqual(r.antal, 5);
  r = g.hyr('alt'); assert.ok(r.ok); assert.strictEqual(st.mandskab, g.maxMandskab()); assert.strictEqual(g.hyr(1).grund, 'fuldt');
  r = g.proviant('alt'); assert.ok(r.ok); assert.strictEqual(st.proviant, L.PROVIANT_MAX);
  assert.strictEqual(g.proviant('fyld').grund, 'fuldt');
  var rg = g.rygte(); assert.ok(rg === null || (L.vareById(rg.vare) && L.havnById(rg.havn)));
});

test('rejse: dage efter afstand og fart, proviant pr. dag, nye priser ved ankomst', function () {
  var g = nyt(3), st = g.state;
  var naer = g.rejseDage('soelvbyen'), fjern = g.rejseDage('kongshavn');
  assert.ok(naer >= 1 && fjern >= naer);
  st.guld = 100000; g.opgrader('sejl'); g.opgrader('sejl');
  assert.ok(g.rejseDage('kongshavn') <= fjern, 'hurtigere sejl giver ikke længere rejse');
  var p0 = st.proviant, d0 = st.dag, d = g.rejseDage('kongshavn');
  var r = g.sejl('kongshavn'); assert.strictEqual(r.dage, d);
  assert.strictEqual(st.dag, d0 + d); assert.strictEqual(st.proviant, Math.max(0, p0 - d));
  if (r.moede) { assert.ok(r.moede.dagNr >= 1 && r.moede.dagNr <= d); assert.strictEqual(g.ankom(), false); r.moede.slut = 'videre'; }
  assert.ok(g.ankom()); assert.strictEqual(st.havn, 'kongshavn'); assert.strictEqual(st.rejse, null);
  assert.strictEqual(g.sejl('kongshavn'), null, 'kan ikke sejle til havnen, man ligger i');
});

test('sult: uden proviant dør mandskabet', function () {
  var g = nyt(), st = g.state; st.proviant = 0;
  var r = g.sejl('ankerholm'); assert.ok(r.sult); assert.ok(r.sult.tab > 0); assert.ok(st.mandskab < 8);
});

test('alle mødetyper forekommer', function () {
  ['handel', 'pirat', 'marine', 'storm'].forEach(function (s) { assert.ok(medMoede(s)); });
});

test('handelsskib er fredeligt og kan få lov at sejle; angreb gør det fjendtligt', function () {
  var g = medMoede('handel'), m = g.state.moede;
  assert.strictEqual(g.erFjendtlig(m), false);
  var h = g.handling('flygt'); assert.strictEqual(m.slut, 'videre'); assert.ok(g.ankom());
  g = medMoede('handel'); m = g.state.moede;
  g.state.kanoner = 2; g.state.mandskab = 8;
  h = g.handling('skyd'); assert.ok(h.spiller.type === 'skud');
  assert.ok(m.slut || g.erFjendtlig(m) || m.provokeret);
});

test('kamp: skyd, ryk nærmere og bord; kapret skib giver guld, last og berømmelse', function () {
  var vundet = 0;
  for (var s = 1; s < 400 && vundet < 5; s++) {
    var g = medMoede('handel', s), st = g.state, m = st.moede;
    st.mandskab = 30; st.kanoner = 2;
    var g0 = st.guld, b0 = st.beroemmelse, i = 0;
    assert.deepStrictEqual(g.handling('bord').fejl, m.afstand > 0 ? 'for-langt' : undefined);
    while (!m.slut && i++ < 30) {
      var h = m.afstand > 0 ? g.handling('naermere') : g.handling('bord');
      assert.ok(h && (h.spiller || h.fejl));
    }
    if (m.slut === 'kapret') {
      vundet++; s += 0;
      assert.ok(st.guld > g0); assert.ok(st.beroemmelse > b0); assert.ok(m.bytte && m.bytte.guld > 0);
      assert.strictEqual(st.tal.kapret, 1);
    }
  }
  assert.ok(vundet >= 1, 'kunne aldrig kapre');
});

test('skyd uden kanoner giver fejl; flugt fra pirat kan lykkes', function () {
  var g = medMoede('pirat'), st = g.state;
  st.kanoner = 0; assert.strictEqual(g.handling('skyd').fejl, 'ingen-kanoner');
  var slap = 0;
  for (var s = 1; s < 300; s++) {
    g = medMoede('pirat', s); var m = g.state.moede, i = 0;
    g.state.skrog = 1000;
    while (!m.slut && i++ < 20) g.handling('flygt');
    if (m.slut === 'flygtet') slap++;
    if (slap > 2) break;
  }
  assert.ok(slap > 0);
});

test('marinen er stærk og dukker oftere op med høj berømmelse; fjendtlig ved berømmelse ≥ 10', function () {
  function andel(ber) {
    var mar = 0, alle = 0;
    for (var s = 1; s < 1500; s++) { var g = nyt(s); g.state.beroemmelse = ber; g.state.proviant = 40; var r = g.sejl('kongshavn'); if (r.moede) { alle++; if (r.moede.slags === 'marine') mar++; } }
    return mar / alle;
  }
  var lav = andel(0), hoej = andel(40);
  assert.ok(hoej > lav * 1.5, lav + ' ' + hoej);
  var g = medMoede('marine', 1, 0); assert.strictEqual(g.erFjendtlig(g.state.moede), false);
  g = medMoede('marine', 1, 12); var m = g.state.moede;
  assert.strictEqual(g.erFjendtlig(m), true);
  var p = medMoede('pirat', 1).state.moede;
  assert.ok(m.kanoner > p.kanoner && m.skrog > p.skrog);
});

test('storm: ride af (skade) eller søg læ (flere dage)', function () {
  var g = medMoede('storm'), st = g.state, s0 = st.skrog;
  var r = g.storm('ride'); assert.ok(r.skade > 0); assert.ok(st.skrog < s0 || st.over); assert.strictEqual(st.moede.slut, 'overstaaet');
  g = medMoede('storm'); var d0 = g.state.dag;
  r = g.storm('laa'); assert.ok(g.state.dag > d0); assert.strictEqual(g.state.moede.slut, 'overstaaet');
});

test('spillet slutter, når skibet synker eller marinen tager dig', function () {
  var sunket = false, taget = false;
  for (var s = 1; s < 400 && !(sunket && taget); s++) {
    var g = medMoede('marine', s, 20), st = g.state, m = st.moede, i = 0;
    st.skrog = s % 2 ? 1000 : 8; st.proviant = 40;
    while (!m.slut && !st.over && i++ < 40) g.handling(m.afstand > 0 && s % 2 ? 'naermere' : (s % 2 ? 'bord' : 'skyd'));
    if (st.over) { assert.ok(['sunket', 'taget', 'mandskab'].indexOf(st.over.grund) >= 0, st.over.grund); if (st.over.grund === 'sunket') sunket = true; if (st.over.grund === 'taget') taget = true; }
  }
  assert.ok(sunket, 'ingen sank'); assert.ok(taget, 'ingen blev taget');
});

test('gå i land: kun i havn, giver point = formue + 10 × berømmelse', function () {
  var g = nyt(), st = g.state; st.beroemmelse = 4; g.koeb('rom', 3);
  var f = g.formue(); var o = g.gaaILand();
  assert.strictEqual(o.grund, 'land'); assert.strictEqual(o.formue, f); assert.strictEqual(o.point, f + 40);
  assert.strictEqual(o.skib, 'slup'); assert.strictEqual(o.dage, st.dag);
  assert.strictEqual(g.sejl('kongshavn'), null, 'intet efter game over');
});

test('simulering: en enkel handelsstrategi tjener penge, og spillet ender aldrig med NaN', function () {
  var formuer = [];
  for (var s = 1; s <= 60; s++) {
    var g = nyt(s), st = g.state, ture = 0, top = g.formue();
    while (!st.over && ture++ < 60) {
      // Sælg alt, køb den bedste vare (rygte), fyld proviant, reparer, hyr
      L.VARER.forEach(function (v) { if (st.last[v.id]) g.saelg(v.id, 'alt'); });
      g.reparer('alt'); g.proviant('fyld');
      if (st.mandskab < 2 * st.kanoner) g.hyr(2 * st.kanoner - st.mandskab);
      if (st.guld > 2500 && g.naesteSkib() && st.guld > g.naesteSkib().pris + 400) g.koebSkib();
      var r = g.rygte(), til;
      if (r && r.gevinst > 0 && r.havn !== st.havn) { g.koeb(r.vare, 'alt'); til = r.havn; }
      else til = L.HAVNE[(L.HAVNE.findIndex(function (h) { return h.id === st.havn; }) + 3) % 8].id;
      var rr = g.sejl(til);
      if (!rr) break;
      var m = st.moede, i = 0;
      while (m && !m.slut && !st.over && i++ < 50) {
        if (m.slags === 'storm') g.storm('ride');
        else if (!g.erFjendtlig(m)) g.handling('flygt');
        else g.handling('flygt');
      }
      if (!st.over) { g.ankom(); top = Math.max(top, g.formue()); }
      ['guld', 'skrog', 'mandskab', 'proviant', 'dag'].forEach(function (k) { assert.ok(isFinite(st[k]) && st[k] >= 0, k + '=' + st[k]); });
    }
    formuer.push(top);
  }
  formuer.sort(function (a, b) { return a - b; });
  var median = formuer[formuer.length >> 1];
  console.log('    median af højeste formue (op til 60 ture): ' + median + ' (min ' + formuer[0] + ', max ' + formuer[formuer.length - 1] + ')');
  assert.ok(median > 3 * L.START.guld, 'handel skal kunne betale sig');
});

console.log('\n' + n + ' tests bestået');
