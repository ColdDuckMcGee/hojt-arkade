// Test af Kaperens spillogik (ingen browser): node kaperen/test/spillogik.test.js
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.KaperenLogik;
var n = 0;
function test(name, fn) { fn(); n++; console.log('OK  ' + name); }
function nyt(seed) { return L.createGame({ seed: seed === undefined ? 7 : seed }); }
var R = L.RETNINGER;
// Et frit havfelt ved siden af (x, y), som ikke er en havn
function nabo(g, x, y, undtag) {
  for (var r = 0; r < 8; r++) {
    var nx = x + R[r][0], ny = y + R[r][1];
    if (g.felt(nx, ny) === 'hav' && !(undtag && undtag[0] === nx && undtag[1] === ny)) return [nx, ny, r];
  }
  return null;
}
// Sejl ét felt ud af havnen uden møder (prøver seeds, til det lykkes)
function tilSoes(seed, ber) {
  for (var s = seed || 1; s < 5000; s++) {
    var g = nyt(s), st = g.state; if (ber) st.beroemmelse = ber;
    st.proviant = 40;
    var nb = nabo(g, st.pos[0], st.pos[1]); if (!nb) continue;
    var r = g.flyt(R[nb[2]][0], R[nb[2]][1]);
    if (r.ok && !r.moede && !st.havn) { st.skibe = []; return g; }
  }
  throw new Error('kom ikke til søs');
}
// Et møde lige nu: læg et skib ved siden af og sejl ind i det
function medMoede(slags, seed, ber) {
  for (var s = seed || 1; s < 5000; s++) {
    var g = tilSoes(s, ber), st = g.state;
    if (slags === 'storm') {
      for (var i = 0; i < 400 && !st.over; i++) { st.skibe = []; st.proviant = 40; var r = g.vent(); if (r.moede && r.moede.slags === 'storm') return g; if (r.moede) { r.moede.slut = 'videre'; g.efterMoede(); } }
      continue;
    }
    var nb = nabo(g, st.pos[0], st.pos[1]); if (!nb) continue;
    g._nytSkib(slags, nb[0], nb[1]);
    var rr = g.flyt(R[nb[2]][0], R[nb[2]][1]);
    if (rr.moede && rr.moede.slags === slags) return g;
  }
  throw new Error('fandt intet ' + slags);
}
// Sejl efter kursen, til den stopper; møder afsluttes med 'videre'
function sejlKurs(g, til, max) {
  var st = g.state, sidste = null;
  for (var i = 0; i < (max || 200) && !st.over; i++) {
    if (!st.kurs) { var k = g.saetKurs(til); if (!k.ok) break; }
    st.skibe = []; st.proviant = Math.max(st.proviant, 5);
    sidste = g.autoTrin();
    if (!sidste) break;
    if (sidste.moede) { if (st.moede.slags === 'storm') g.storm('ride'); else st.moede.slut = 'videre'; g.efterMoede(); }
    if (sidste.stop === 'fremme') break;
  }
  return sidste;
}

test('5 varer, 8 havne med navne, 4 skibe i stigende størrelse', function () {
  assert.strictEqual(L.VARER.length, 5);
  assert.strictEqual(L.HAVNE.length, 8);
  var ids = {};
  L.HAVNE.forEach(function (h) { assert.ok(h.navn && !ids[h.id] && /^[a-z]+$/.test(h.id), h.id); ids[h.id] = 1; assert.ok(h.billig.length && h.dyr.length); });
  for (var i = 1; i < L.SKIBE.length; i++) ['last', 'skrog', 'kanoner', 'mandskab', 'pris'].forEach(function (k) { assert.ok(L.SKIBE[i][k] > L.SKIBE[i - 1][k], k); });
});

test('ny rejse: slup i Tågeskær med 300 guld; point = formue + 50 × berømmelse', function () {
  var g = nyt(), st = g.state;
  assert.strictEqual(st.skib, 'slup'); assert.strictEqual(st.guld, 300); assert.strictEqual(L.START.guld, 300);
  assert.strictEqual(st.havn, 'taageskaer'); assert.strictEqual(st.over, null); assert.strictEqual(st.version, 2);
  assert.deepStrictEqual(st.pos, g.havnePos('taageskaer'));
  assert.strictEqual(L.BEROEMMELSE_FAKTOR, 50);
  st.beroemmelse = 3; assert.strictEqual(g.point(), g.formue() + 150);
});

test('tilfældigt hav for hvert spil: 24 × 15 felter, alle havne kan nås over vand', function () {
  var a = nyt(1), b = nyt(2);
  assert.strictEqual(a.state.felt.length, L.BREDDE * L.HOEJDE);
  assert.notStrictEqual(a.state.felt, b.state.felt, 'to seeds giver to forskellige have');
  for (var s = 1; s <= 30; s++) {
    var g = nyt(s), st = g.state, pos = {};
    L.HAVNE.forEach(function (h) {
      var p = g.havnePos(h.id); assert.ok(p, h.id); assert.strictEqual(g.felt(p[0], p[1]), 'havn');
      var k = p[0] + ',' + p[1]; assert.ok(!pos[k], 'to havne på samme felt'); pos[k] = 1;
      // Gør alt kendt, så stien kan findes
    });
    st.set = st.set.replace(/0/g, '1'); L.HAVNE.forEach(function (h) { st.kendt[h.id] = true; });
    L.HAVNE.forEach(function (h) { if (h.id !== st.havn) assert.ok(g.sti(h.id) && g.sti(h.id).length > 0, 'ingen vej til ' + h.id + ' (seed ' + s + ')'); });
  }
});

test('tåge: kun synsvidden omkring startHavnen er opdaget, og kun starthavnen er kendt', function () {
  var g = nyt(5), st = g.state, x, y, sete = 0;
  assert.deepStrictEqual(g.kendteHavne(), ['taageskaer']);
  for (y = 0; y < L.HOEJDE; y++) for (x = 0; x < L.BREDDE; x++) {
    var d2 = Math.pow(x - st.pos[0], 2) + Math.pow(y - st.pos[1], 2), r = L.SYN + 0.5;
    assert.strictEqual(g.sett(x, y), d2 <= r * r, x + ',' + y);
    if (g.sett(x, y)) sete++;
  }
  assert.ok(g.andelOpdaget() > 0 && g.andelOpdaget() < 0.15, String(g.andelOpdaget()));
  assert.strictEqual(g.felt(-1, 0), 'ude'); assert.strictEqual(g.sett(-1, 0), false);
});

test('opdagelse: at sejle ét felt tager én dag og én proviant og afslører nyt hav', function () {
  var g = tilSoes(3), st = g.state;
  var d0 = st.dag, p0 = st.proviant, a0 = g.andelOpdaget(), pos0 = st.pos.slice(), ok = 0;
  for (var t = 0; t < 30 && ok < 4; t++) {
    var nb = nabo(g, st.pos[0], st.pos[1], pos0); if (!nb) break;
    st.skibe = [];
    var dag = st.dag, prov = st.proviant, r = g.flyt(R[nb[2]][0], R[nb[2]][1]);
    if (r.moede) { if (st.moede.slags === 'storm') g.storm('ride'); else st.moede.slut = 'videre'; g.efterMoede(); continue; }
    assert.ok(r.ok); assert.strictEqual(st.dag, dag + 1); assert.strictEqual(st.proviant, prov - 1);
    assert.deepStrictEqual(st.pos, [nb[0], nb[1]]); pos0 = st.pos.slice(); ok++;
  }
  assert.ok(ok >= 2); assert.ok(g.andelOpdaget() > a0);
  assert.ok(st.dag > d0 && st.proviant < p0);
});

test('man kan ikke sejle på land, ud over kanten eller stå stille; vent koster en dag til søs', function () {
  var g = tilSoes(4), st = g.state, x, y, ramt = { land: 0, kant: 0 };
  for (var r = 0; r < 8; r++) {
    var f = g.felt(st.pos[0] + R[r][0], st.pos[1] + R[r][1]);
    if (f === 'land' || f === 'ude') {
      var pos = st.pos.slice(), dag = st.dag, res = g.flyt(R[r][0], R[r][1]);
      assert.strictEqual(res.ok, false); assert.strictEqual(res.grund, f === 'land' ? 'land' : 'kant');
      assert.deepStrictEqual(st.pos, pos); assert.strictEqual(st.dag, dag);
    }
  }
  assert.strictEqual(g.flyt(0, 0).grund, 'stille');
  var d = st.dag, p = st.proviant; st.skibe = [];
  var v = g.vent(); assert.ok(v.ok); assert.strictEqual(st.dag, d + 1); assert.strictEqual(st.proviant, p - 1);
  // Ud ved kanten af havet
  var h = nyt(9); h.state.pos = [0, 0]; h.state.havn = null; h.state.felt = '0' + h.state.felt.slice(1);
  assert.strictEqual(h.flyt(-1, 0).grund, 'kant'); assert.strictEqual(h.flyt(0, -1).grund, 'kant');
  assert.strictEqual(nyt().vent().grund, 'havn', 'man venter ikke i havn');
});

test('ny havn i synsvidde bliver kendt; at sejle ind i den lægger til, og priserne skifter', function () {
  for (var s = 1; s < 200; s++) {
    var g = nyt(s), st = g.state;
    st.set = st.set.replace(/0/g, '1');
    var til = L.HAVNE.filter(function (h) { return h.id !== st.havn; }).map(function (h) { return h.id; })
      .sort(function (a, b) { return g.sti(a) && g.sti(b) ? 0 : 0; })[0];
    st.kendt[til] = true;
    var v = g.sti(til); if (!v || v.length > 12) continue;
    st.kendt[til] = false; st.proviant = 40;
    var foer = JSON.stringify(st.priser[til]), sidst = null;
    for (var i = 0; i < v.length; i++) {
      st.skibe = [];
      sidst = g.flyt(v[i][0] - st.pos[0], v[i][1] - st.pos[1]);
      if (sidst.moede) { if (st.moede.slags === 'storm') g.storm('ride'); else st.moede.slut = 'videre'; g.efterMoede(); i--; continue; }
      if (st.havn && st.havn !== til) { /* anden havn på vejen */ }
    }
    if (st.over) continue;
    assert.ok(st.kendt[til], 'havnen blev opdaget'); assert.strictEqual(st.havn, til); assert.strictEqual(sidst.havn, til);
    assert.notStrictEqual(JSON.stringify(st.priser[til]), foer);
    assert.ok(g.kanHandle());
    return;
  }
  throw new Error('fandt ingen kort vej');
});

test('kurs: sti kun over opdaget vand til kendte havne; sejler selv og stopper ved ankomst', function () {
  var g = nyt(11), st = g.state;
  var andre = L.HAVNE.filter(function (h) { return h.id !== st.havn; })[0].id;
  assert.strictEqual(g.saetKurs(andre).grund, 'ukendt');
  assert.strictEqual(g.saetKurs(st.havn).grund, 'her');
  st.kendt[andre] = true;
  assert.ok(g.sti(andre) === null || g.sti(andre).every(function (p) { return g.sett(p[0], p[1]); }));
  st.set = st.set.replace(/0/g, '1');
  var info = g.kursInfo(andre); assert.ok(info && info.dage > 0); assert.strictEqual(info.dage, info.sti.length);
  st.proviant = 2; info = g.kursInfo(andre); assert.strictEqual(info.nok, info.dage <= 2);
  st.proviant = 40;
  var k = g.saetKurs(andre); assert.ok(k.ok); assert.strictEqual(k.dage, info.dage);
  var r = sejlKurs(g, andre);
  assert.strictEqual(st.havn, andre); assert.strictEqual(r.stop, 'fremme'); assert.strictEqual(st.kurs, null);
});

test('kurs stopper, når et skib kommer i sigte, og når proviantet slipper op', function () {
  var stopSkib = false, stopProv = false;
  for (var s = 1; s < 300 && !(stopSkib && stopProv); s++) {
    var g = nyt(s), st = g.state; st.set = st.set.replace(/0/g, '1');
    var til = null;
    L.HAVNE.forEach(function (h) { st.kendt[h.id] = true; });
    L.HAVNE.forEach(function (h) { if (!til && h.id !== st.havn && g.sti(h.id).length >= 5) til = h.id; });
    if (!til) continue;
    st.proviant = 40;
    if (!stopSkib) {
      g.saetKurs(til); st.skibe = []; var r = g.autoTrin();
      if (r.stop) continue;
      // Læg et skib lige inden for synsvidden
      var x, y, sat = false;
      for (y = 0; y < L.HOEJDE && !sat; y++) for (x = 0; x < L.BREDDE && !sat; x++) {
        var d = Math.max(Math.abs(x - st.pos[0]), Math.abs(y - st.pos[1]));
        if (d === L.SYN && g.felt(x, y) === 'hav' && g.iSyn(x, y)) { g._nytSkib('handel', x, y); sat = true; }
      }
      // Skibet er allerede i sigte: det tæller ikke som nyt. Fjern og læg det igen udenfor
      st.skibe = [];
      var r2 = g.autoTrin(); if (r2.stop) continue;
      var nyt0 = 0;
      for (var i = 0; i < 40 && st.kurs && !st.over; i++) {
        if (!st.skibe.length) for (y = 0; y < L.HOEJDE && !st.skibe.length; y++) for (x = 0; x < L.BREDDE && !st.skibe.length; x++) {
          var dd = Math.max(Math.abs(x - st.pos[0]), Math.abs(y - st.pos[1]));
          if (dd === L.SYN + 2 && g.felt(x, y) === 'hav') g._nytSkib('handel', x, y);
        }
        st.skibe.forEach(function (sk) { sk.maal = st.pos.slice(); sk.fart = 9; });
        var rr = g.autoTrin();
        if (rr.stop === 'skib') { assert.ok(rr.nyeSkibe.length > 0); assert.strictEqual(st.kurs, null); stopSkib = true; break; }
        if (rr.stop) break;
      }
    }
    var g2 = nyt(s), s2 = g2.state; s2.set = s2.set.replace(/0/g, '1');
    L.HAVNE.forEach(function (h) { s2.kendt[h.id] = true; });
    s2.proviant = 2; g2.saetKurs(til);
    for (var j = 0; j < 10 && s2.kurs; j++) { s2.skibe = []; var q = g2.autoTrin(); if (q.stop === 'proviant') { assert.strictEqual(s2.proviant, 0); stopProv = true; } }
  }
  assert.ok(stopSkib, 'kursen stoppede aldrig for et skib'); assert.ok(stopProv, 'kursen stoppede aldrig for proviant');
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
  var g = tilSoes(1);
  assert.strictEqual(g.koeb('rom', 1).ok, false); assert.strictEqual(g.koebKikkert().ok, false); assert.strictEqual(g.rygteHavn().ok, false);
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

test('proviant bruges pr. dag; uden proviant dør mandskabet', function () {
  var g = tilSoes(2), st = g.state; st.proviant = 3;
  for (var i = 0; i < 3; i++) { st.skibe = []; var r = g.vent(); if (r.moede) { st.moede.slags === 'storm' ? g.storm('ride') : 0; st.moede.slut = st.moede.slut || 'videre'; g.efterMoede(); } assert.strictEqual(r.sult, null); }
  assert.strictEqual(st.proviant, 0);
  var m0 = st.mandskab; st.skibe = [];
  r = g.vent(); assert.ok(r.sult && r.sult.tab > 0); assert.ok(st.mandskab < m0);
  st.mandskab = 1; st.skibe = []; st.moede = null; r = g.vent(); assert.strictEqual(st.over.grund, 'sult');
});

test('kikkert fra værftet: synsvidde 2 → 3 → 4', function () {
  var g = nyt(), st = g.state; st.guld = 100000;
  assert.strictEqual(g.synsvidde(), L.SYN); assert.strictEqual(g.kikkertPris(), L.KIKKERT_PRIS[0]);
  var g0 = st.guld, r = g.koebKikkert(); assert.ok(r.ok); assert.strictEqual(r.syn, L.SYN + 1); assert.strictEqual(st.guld, g0 - L.KIKKERT_PRIS[0]);
  r = g.koebKikkert(); assert.ok(r.ok); assert.strictEqual(g.synsvidde(), L.SYN + 2);
  assert.strictEqual(g.kikkertPris(), null); assert.strictEqual(g.koebKikkert().grund, 'max');
  var h = nyt(); h.state.guld = 10; var f = h.koebKikkert(); assert.strictEqual(f.grund, 'guld'); assert.strictEqual(f.mangler, L.KIKKERT_PRIS[0] - 10);
  // Større synsvidde opdager mere ved næste skridt
  var a = tilSoes(6), b = tilSoes(6); b.state.kikkert = 2;
  var nb = nabo(a, a.state.pos[0], a.state.pos[1]);
  a.flyt(R[nb[2]][0], R[nb[2]][1]); b.flyt(R[nb[2]][0], R[nb[2]][1]);
  assert.ok(b.andelOpdaget() > a.andelOpdaget());
});

test('rygte i værtshuset: en ukendt havn bliver kendt for 25 guld', function () {
  var g = nyt(8), st = g.state;
  assert.strictEqual(g.rygtePris(), L.RYGTE_PRIS);
  var n0 = g.kendteHavne().length, g0 = st.guld, r = g.rygteHavn();
  assert.ok(r.ok); assert.strictEqual(st.guld, g0 - 25); assert.ok(st.kendt[r.havn]);
  assert.strictEqual(g.kendteHavne().length, n0 + 1);
  var p = g.havnePos(r.havn); assert.ok(g.sett(p[0], p[1]), 'havnen er tegnet på kortet');
  st.guld = 100000; while (g.rygtePris() !== null) assert.ok(g.rygteHavn().ok);
  assert.strictEqual(g.kendteHavne().length, L.HAVNE.length); assert.strictEqual(g.rygteHavn().grund, 'alle');
  var h = nyt(); h.state.guld = 3; assert.strictEqual(h.rygteHavn().grund, 'guld');
});

test('skibe til søs: synlige inden for synsvidden, og at sejle ind i et starter et møde uden at bruge en dag', function () {
  var g = tilSoes(5), st = g.state;
  var nb = nabo(g, st.pos[0], st.pos[1]);
  var sk = g._nytSkib('pirat', nb[0], nb[1]);
  assert.ok(g.synligeSkibe().some(function (s) { return s.id === sk.id; }));
  var d = st.dag, r = g.flyt(R[nb[2]][0], R[nb[2]][1]);
  assert.ok(r.moede); assert.strictEqual(r.moede.slags, 'pirat'); assert.strictEqual(st.dag, d);
  assert.strictEqual(g.flyt(1, 0).grund, 'moede'); assert.strictEqual(g.saetKurs(st.sidste).grund, 'moede');
  st.moede.slut = 'flygtet'; assert.ok(g.efterMoede());
  assert.ok(!st.skibe.some(function (s) { return s.id === sk.id; }), 'skibet forsvinder efter mødet');
  // Et fjern skib er ikke synligt
  var x, y, fjern = null;
  for (y = 0; y < L.HOEJDE && !fjern; y++) for (x = 0; x < L.BREDDE && !fjern; x++) if (g.felt(x, y) === 'hav' && !g.iSyn(x, y)) fjern = g._nytSkib('handel', x, y);
  assert.ok(!g.synligeSkibe().some(function (s) { return s.id === fjern.id; }));
});

test('sørøvere jager dig, når de er tæt på', function () {
  var naermere = 0, i;
  for (var s = 1; s < 60; s++) {
    var g = tilSoes(s), st = g.state, x, y, sk = null;
    for (y = 0; y < L.HOEJDE && !sk; y++) for (x = 0; x < L.BREDDE && !sk; x++) {
      if (g.felt(x, y) === 'hav' && Math.max(Math.abs(x - st.pos[0]), Math.abs(y - st.pos[1])) === 4) sk = g._nytSkib('pirat', x, y);
    }
    if (!sk) continue;
    var d0 = Math.max(Math.abs(sk.x - st.pos[0]), Math.abs(sk.y - st.pos[1]));
    for (i = 0; i < 3 && !st.moede; i++) g.vent();
    var still = st.skibe.filter(function (q) { return q.id === sk.id; })[0];
    if (st.moede || (still && Math.max(Math.abs(still.x - st.pos[0]), Math.abs(still.y - st.pos[1])) < d0)) naermere++;
  }
  assert.ok(naermere > 30, String(naermere));
});

test('marinen jager dig først fra berømmelse 10', function () {
  function jagter(ber) {
    var n = 0;
    for (var s = 1; s < 60; s++) {
      var g = tilSoes(s, ber), st = g.state, x, y, sk = null;
      for (y = 0; y < L.HOEJDE && !sk; y++) for (x = 0; x < L.BREDDE && !sk; x++)
        if (g.felt(x, y) === 'hav' && Math.max(Math.abs(x - st.pos[0]), Math.abs(y - st.pos[1])) === 4) sk = g._nytSkib('marine', x, y);
      if (!sk) continue;
      sk.maal = [sk.x, sk.y];
      for (var i = 0; i < 3 && !st.moede; i++) { st.proviant = 40; g.vent(); }
      var k = st.skibe.filter(function (q) { return q.id === sk.id; })[0];
      if (st.moede || (k && Math.max(Math.abs(k.x - st.pos[0]), Math.abs(k.y - st.pos[1])) < 4)) n++;
    }
    return n;
  }
  var fred = jagter(9), jagt = jagter(10);
  assert.ok(jagt > fred + 15, fred + ' ' + jagt);
});

test('alle mødetyper forekommer', function () {
  ['handel', 'pirat', 'marine', 'storm'].forEach(function (s) { assert.ok(medMoede(s)); });
});

test('handelsskib er fredeligt og kan få lov at sejle; angreb gør det fjendtligt', function () {
  var g = medMoede('handel'), m = g.state.moede;
  assert.strictEqual(g.erFjendtlig(m), false);
  var h = g.handling('flygt'); assert.strictEqual(m.slut, 'videre'); assert.ok(g.efterMoede()); assert.strictEqual(g.state.moede, null);
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

test('marinen er stærk og dukker oftere op med høj berømmelse; jager og er fjendtlig fra berømmelse 10', function () {
  function andel(ber) {
    var mar = 0, alle = 0;
    for (var s = 1; s < 120; s++) {
      var g = tilSoes(s, ber), st = g.state, set = {};
      for (var d = 0; d < 60 && !st.over; d++) {
        st.proviant = 40; st.skrog = 1000;
        var r = g.vent();
        st.skibe.forEach(function (k) { if (!set[k.id]) { set[k.id] = 1; alle++; if (k.slags === 'marine') mar++; } });
        if (r.moede) { st.moede.slut = 'videre'; g.efterMoede(); }
        st.skibe = st.skibe.filter(function (k) { return Math.max(Math.abs(k.x - st.pos[0]), Math.abs(k.y - st.pos[1])) > 1; });
      }
    }
    return mar / alle;
  }
  var lav = andel(0), hoej = andel(40);
  assert.ok(hoej > lav * 1.5, lav + ' ' + hoej);
  var g = medMoede('marine', 1, 9); assert.strictEqual(g.erFjendtlig(g.state.moede), false);
  g = medMoede('marine', 1, 10); var m = g.state.moede;
  assert.strictEqual(g.erFjendtlig(m), true);
  var p = medMoede('pirat', 1).state.moede;
  assert.ok(m.kanoner > p.kanoner && m.skrog > p.skrog);
});

test('storm: ride af (skade) eller søg læ (flere dage)', function () {
  var g = medMoede('storm'), st = g.state, s0 = st.skrog;
  var r = g.storm('ride'); assert.ok(r.skade > 0); assert.ok(st.skrog < s0 || st.over); assert.strictEqual(st.moede.slut, 'overstaaet');
  g = medMoede('storm'); var d0 = g.state.dag;
  var p0 = g.state.proviant;
  r = g.storm('laa'); assert.strictEqual(g.state.dag, d0 + 2); assert.strictEqual(g.state.proviant, p0 - 2); assert.strictEqual(g.state.moede.slut, 'overstaaet');
  assert.ok(g.efterMoede()); assert.ok(g.vent().ok, 'man kan sejle videre efter stormen');
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

test('gå i land: kun i havn, giver point = formue + 50 × berømmelse', function () {
  var g = tilSoes(1); assert.strictEqual(g.gaaILand(), null, 'ikke til søs');
  g = nyt(); var st = g.state; st.beroemmelse = 4; g.koeb('rom', 3);
  var f = g.formue(); var o = g.gaaILand();
  assert.strictEqual(o.grund, 'land'); assert.strictEqual(o.formue, f); assert.strictEqual(o.point, f + 200);
  assert.strictEqual(o.skib, 'slup'); assert.strictEqual(o.dage, st.dag);
  assert.strictEqual(g.flyt(1, 0).ok, false, 'intet efter game over');
});

test('gemt spil fra v1 indlæses: samme skib, guld og last i den samme havn på et nyt hav', function () {
  var v1 = { seed: 5, dag: 30, guld: 1234, havn: null, skib: 'brig', skrog: 70, kanoner: 4, mandskab: 14, proviant: 9, sejl: 1, lastrum: 0,
    investeret: 900, last: { rom: 3, sukker: 0, tobak: 0, krydderi: 0, silke: 0 }, betalt: { rom: 60, sukker: 0, tobak: 0, krydderi: 0, silke: 0 },
    beroemmelse: 6, priser: {}, besoeg: { taageskaer: 2 }, moede: { slags: 'pirat', slut: null }, over: null,
    rejse: { fra: 'soelvbyen', til: 'kongshavn', dage: 3 }, tal: { rejser: 4, kapret: 1, sænket: 0, flygtet: 0, handel: 9 } };
  var g = L.createGame(JSON.parse(JSON.stringify(v1))), st = g.state;
  assert.strictEqual(st.version, 2); assert.strictEqual(st.migreret, true);
  assert.strictEqual(st.havn, 'soelvbyen'); assert.deepStrictEqual(st.pos, g.havnePos('soelvbyen'));
  assert.strictEqual(st.guld, 1234); assert.strictEqual(st.skib, 'brig'); assert.strictEqual(st.last.rom, 3); assert.strictEqual(st.beroemmelse, 6);
  assert.strictEqual(st.moede, null); assert.strictEqual(st.rejse, undefined); assert.deepStrictEqual(g.kendteHavne(), ['soelvbyen']);
  assert.ok(g.kanHandle()); assert.ok(g.felt(st.pos[0], st.pos[1]) === 'havn');
  // ... og kan gemmes og indlæses igen som v2
  var igen = L.createGame(g.save()); assert.deepStrictEqual(igen.save(), g.save());
  var h = L.createGame({ seed: 1, havn: 'ravnsoe', skib: 'slup', guld: 50, last: { rom: 0, sukker: 0, tobak: 0, krydderi: 0, silke: 0 }, betalt: { rom: 0, sukker: 0, tobak: 0, krydderi: 0, silke: 0 }, tal: {} });
  assert.strictEqual(h.state.havn, 'ravnsoe');
});

test('simulering: handel tjener penge, pirateri giver flere point pr. formue, og intet bliver NaN', function () {
  var sim = require('./simulering.js');
  var res = sim.koer(100, 150), med = {};
  ['handel', 'kaper', 'pirat'].forEach(function (b) {
    res[b].forEach(function (r) { assert.ok(isFinite(r.formue) && r.formue >= 0 && isFinite(r.beroemmelse), b + ' ' + JSON.stringify(r)); });
    med[b] = { formue: sim.median(res[b].map(function (r) { return r.formue; })), ber: sim.median(res[b].map(function (r) { return r.beroemmelse; })) };
  });
  console.log('    median formue – handel ' + med.handel.formue + ', kaper ' + med.kaper.formue + ', pirat ' + med.pirat.formue);
  var land = res.handel.filter(function (r) { return r.over === 'land'; }).map(function (r) { return r.formue; });
  assert.ok(sim.median(land) > 3 * L.START.guld, 'handel skal kunne betale sig for dem, der går i land');
  var pirB = res.pirat.reduce(function (s, r) { return s + r.beroemmelse; }, 0), hanB = res.handel.reduce(function (s, r) { return s + r.beroemmelse; }, 0);
  assert.ok(pirB > hanB, 'pirater bliver mere berømte');
});

console.log('\n' + n + ' tests bestået');
