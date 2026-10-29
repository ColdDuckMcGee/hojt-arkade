// Test af Rumhandlerens spillogik (ingen browser): node rumhandleren/test/logik.test.js
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.RumhandlerenLogik;
var n = 0;
function test(name, fn) { fn(); n++; console.log('OK  ' + name); }
function nyt(seed) { return L.createGame({ seed: seed === undefined ? 7 : seed }); }
// Fjern pirater og begivenheder helt i en test: sæt alle ruters risiko-tjek til at fejle
function rolig(g) { L.PLANETER.forEach(function (p) { g.state.events.push({ id: 'piratjagt', planet: p.id, varer: ['pirater'], f: [0], slut: 1e9, tekst: 'test' }); }); }

// ---------- Data ----------
test('12 planeter, 8 varer, 3 fraktioner, alle planeter er forbundet', function () {
  assert.strictEqual(L.PLANETER.length, 12);
  assert.strictEqual(L.VARER.length, 8);
  assert.strictEqual(L.FRAKTIONER.length, 3);
  var g = nyt(); L.PLANETER.forEach(function (p) { p.laast && (g.state.omdoemme[p.fraktion] = 100); });
  L.PLANETER.forEach(function (p) { assert.ok(g.sti('kepler', p.id), 'vej til ' + p.id); });
  L.PLANETER.forEach(function (p) {
    var prod = L.VARER.some(function (v) { return (p.n[v.id] || 0) > 0; }), forb = L.VARER.some(function (v) { return (p.n[v.id] || 0) < 0; });
    assert.ok(prod && forb, p.id + ' både producerer og forbruger');
  });
});

// ---------- Økonomi ----------
test('producent er billig, forbruger er dyr', function () {
  var g = nyt();
  assert.ok(g.pris('mad', 'kepler').koeb < g.pris('mad', 'vega').koeb);   // Kepler dyrker mad, Vega sulter
  assert.strictEqual(g.pris('mad', 'kepler').niveau, 'billig');
  assert.strictEqual(g.pris('maskiner', 'kepler').niveau, 'dyr');
  assert.ok(g.pris('mad', 'kepler').salg < g.pris('mad', 'kepler').koeb, 'salgspris under købspris');
});
test('egne køb hæver prisen, og salg sænker den', function () {
  var g = nyt(), f = g.pris('mad').koeb;
  var r = g.koeb('mad', 15); assert.ok(r.ok);
  assert.ok(g.pris('mad').koeb > f, 'prisen steg');
  assert.strictEqual(g.flagskib().last.mad, 15);
  var s = g.pris('mad').salg; g.saelg('mad', 10);
  assert.ok(g.pris('mad').salg < s, 'prisen faldt');
  assert.ok(g.prisFor('kepler', 'mad', 10, true) > 10 * g.pris('mad').koeb - 1, 'prisFor regner glidende pris');
});
test('køb begrænses af penge og lastrum', function () {
  var g = nyt();
  g.state.kredit = 100000; var r = g.koeb('mad', 'max'); assert.strictEqual(r.antal, 20);
  assert.strictEqual(g.koeb('vand', 1).grund, 'fuld');
  var h = nyt(); h.state.kredit = 50; assert.strictEqual(h.koeb('maskiner', 1).ok, false);
});
test('priserne driver tilbage mod ligevægt', function () {
  var g = nyt(); rolig(g);
  var lager = g.state.planeter.kepler.lager; lager.mad = 20;
  var p0 = g.pris('mad').koeb; for (var i = 0; i < 20; i++) g.vent();
  assert.ok(g.pris('mad').koeb < p0 * 0.7, 'billigere efter 20 dage');
});
test('begivenheder ændrer priser og står i nyhederne', function () {
  var g = nyt(), f = g.pris('mad', 'vega').koeb;
  g.state.events.push({ id: 'hunger', planet: 'vega', varer: ['mad'], f: [3], slut: 99, tekst: 'Hungersnød på Vega: mad +200 %' });
  assert.ok(g.pris('mad', 'vega').koeb > f * 2.5);
  var h = nyt(3); for (var i = 0; i < 30; i++) h._nyBegivenhed();
  assert.ok(h.state.events.length > 0 && h.state.nyheder.some(function (x) { return x.slags === 'nyhed'; }));
  h.state.events.forEach(function (e) { if (e.id === 'razzia') assert.strictEqual(L.PLANET[e.planet].fraktion, 'vega'); });
});

// ---------- Rejser og brændstof ----------
test('rejser koster dage og brændstof; kortest vej vælges', function () {
  var g = nyt(); rolig(g);
  var info = g.rejseInfo('vega');
  assert.strictEqual(info.dage, 2); assert.strictEqual(info.braendstof, 2); assert.ok(info.kanFlyve);
  var r = g.flyv('vega'); assert.ok(r.ok);
  assert.strictEqual(g.state.dag, 3); assert.strictEqual(g.her(), 'vega');
  assert.strictEqual(g.flagskib().braendstof, 8);
  var lang = g.rejseInfo('kanthavn'); assert.deepStrictEqual(lang.sti, ['vega', 'rigel', 'kanthavn']); assert.strictEqual(lang.dage, 4);
});
test('tom tank tankes automatisk, men uden penge kan man ikke flyve', function () {
  var g = nyt(); rolig(g); g.flagskib().braendstof = 0;
  var k = g.state.kredit, r = g.flyv('sirius'); assert.ok(r.ok);
  assert.ok(g.state.kredit < k, 'betalte for brændstof');
  var h = nyt(); h.flagskib().braendstof = 0; h.state.kredit = 0;
  assert.strictEqual(h.rejseInfo('sirius').kanFlyve, false);
  assert.strictEqual(h.flyv('sirius').ok, false);
});
test('låste planeter kræver omdømme', function () {
  var g = nyt(); rolig(g);
  assert.strictEqual(g.adgang('altair'), false);
  assert.strictEqual(g.rejseInfo('altair').grund, 'laast');
  g.state.omdoemme.vega = 25; assert.ok(g.adgang('altair')); assert.ok(g.rejseInfo('altair').kanFlyve);
});
test('forventet fortjeneste foreslår en vare', function () {
  var g = nyt(); var info = g.rejseInfo('vega');
  assert.ok(info.forslag && info.forslag.gevinst > 0, 'forslag med gevinst');
  assert.strictEqual(info.forslag.vare, 'mad');
});

// ---------- Risiko uden kamp ----------
function piratMoede(seed) {
  for (var s = seed || 1; s < 3000; s++) {
    var g = nyt(s); g.state.omdoemme.kant = 0; g.flagskib().pos = 'kanthavn'; g.state.kredit = 5000;
    g.koeb('vand', 10);
    var r = g.flyv('tau'); if (r.moede) return g;
  }
  throw new Error('intet piratmøde');
}
test('pirater: betal', function () {
  var g = piratMoede(), k = g.state.kredit, krav = g.state.moede.krav;
  var r = g.pirat('betal'); assert.ok(r.ok);
  assert.strictEqual(g.state.moede, null); assert.strictEqual(g.her(), 'tau');
  assert.ok(g.state.kredit <= k - krav);
});
test('pirater: flugt lykkes eller koster halvdelen af lasten', function () {
  var slap = 0, tabt = 0;
  for (var s = 1; s < 400 && slap + tabt < 30; s += 7) {
    var g = piratMoede(s), foer = g.flagskib().last.vand || 0, r = g.pirat('flygt');
    if (r.slap) { slap++; assert.strictEqual(g.flagskib().last.vand || 0, foer); }
    else { tabt++; assert.ok((g.flagskib().last.vand || 0) <= foer / 2); }
  }
  assert.ok(slap > 0 && tabt > 0);
});
test('pirater: forsikring dækker 80 %, men kun hvis man har den', function () {
  var g = piratMoede(); assert.strictEqual(g.pirat('forsikring').ok, false);
  g.state.forsikring = true; var k = g.state.kredit, v = g.lastVaerdi(g.flagskib().last);
  assert.ok(g.pirat('forsikring').ok);
  assert.ok(g.state.kredit >= k + Math.round(v * 0.8) - 1 - 200);   // told kan trækkes ved ankomst
  assert.deepStrictEqual(g.flagskib().last, {});
});
test('told ved ankomst; toldfri ved højt omdømme', function () {
  var g = nyt(); rolig(g); g.koeb('mad', 20);
  assert.ok(g.toldFor('vega', g.flagskib().last) > 0);
  g.state.omdoemme.vega = 50; assert.strictEqual(g.toldFor('vega', g.flagskib().last), 0);
});
test('smugling: glimmer konfiskeres ved toldkontrol i Vega-unionen', function () {
  var fanget = 0, slap = 0;
  for (var s = 1; s < 200; s++) {
    var g = nyt(s); rolig(g); g.flagskib().last = { glimmer: 10 }; g.state.kredit = 3000;
    g.flyv('vega');
    if (!g.flagskib().last.glimmer) { fanget++; assert.ok(g.state.omdoemme.vega < 10); assert.ok(g.state.kredit < 3000 - 500); }
    else slap++;
  }
  assert.ok(fanget > 20 && slap > 60, fanget + '/' + slap);
  var h = nyt(); assert.ok(h.pris('glimmer', 'vega').forbudt && h.pris('glimmer', 'vega').salg > h.pris('glimmer', 'kepler').salg, 'sortbørspris');
});

// ---------- Imperium ----------
test('køb skib og sæt det på en fast rute; det handler selv', function () {
  var g = nyt(); rolig(g); g.state.kredit = 30000;
  var r = g.koebSkib('pelikan'); assert.ok(r.ok);
  assert.strictEqual(g.state.kredit, 22000); assert.strictEqual(g.state.skibe.length, 2);
  assert.ok(g.saetRute(r.skib.id, 'kepler', 'vega').ok);
  assert.ok(g.state.kredit < 22000, 'købte last');
  for (var i = 0; i < 20; i++) g.vent();
  assert.ok(r.skib.rute.tur >= 4, 'har fløjet frem og tilbage');
  assert.ok(g.state.stat.ruteIndtaegt > 0);
  assert.strictEqual(g.saetRute(g.flagskib().id, 'kepler', 'vega').ok, false, 'flagskibet kan ikke automatiseres');
  var e = g.ruteEstimat('kepler', 'vega', 'pelikan'); assert.ok(e && e.dage === 4);
});
test('mine og fabrik producerer til lageret; lager giver plads', function () {
  var g = nyt(); rolig(g); g.state.kredit = 50000;
  assert.ok(g.byg('mine').ok); assert.strictEqual(g.byg('mine').ok, false, 'kun én mine pr. planet');
  assert.strictEqual(g.byg('fabrik').ok, false, 'Kepler har ingen fabrik');
  for (var i = 0; i < 5; i++) g.vent();
  assert.strictEqual(g.state.bygninger.kepler.varer.mad, 20);
  assert.ok(g.hentLager().ok); assert.strictEqual(g.flagskib().last.mad, 20);
  assert.ok(g.byg('lager').ok); assert.strictEqual(g.lagerPlads(g.state.bygninger.kepler), 230);
  g.flagskib().pos = 'vega'; assert.ok(g.byg('fabrik').ok);
  var k = g.state.kredit; g.vent();
  assert.ok(g.state.bygninger.vega.varer.medicin === 4, 'fabrikken laver medicin af mad'); assert.ok(g.state.kredit < k, 'købte mad lokalt');
});
test('fuldt lager sælges automatisk lokalt (passiv indtægt)', function () {
  var g = nyt(); rolig(g); g.state.kredit = 50000; g.byg('mine');
  for (var i = 0; i < 10; i++) g.vent();
  assert.strictEqual(g.state.bygninger.kepler.varer.mad, 30);
  assert.ok(g.state.stat.produktion > 0);
});

// ---------- Kontrakter og omdømme ----------
test('kontrakt: tag, lever og få betaling og omdømme', function () {
  var g = nyt(); rolig(g); g.state.kredit = 100000;
  var k = g.tilbud()[0]; assert.ok(k && k.fraktion === 'vega' && k.til !== 'kepler');
  assert.ok(g.tagKontrakt(k.id).ok);
  g.flagskib().type = 'hval'; g.flagskib().last[k.vare] = k.antal;
  g.flyv(k.til);
  assert.ok(g.kanLevere(k.id));
  var kr = g.state.kredit, rep = g.state.omdoemme.vega, r = g.lever(k.id);
  assert.ok(r.ok); assert.strictEqual(g.state.kredit, kr + k.betaling); assert.strictEqual(g.state.omdoemme.vega, rep + k.rep);
  assert.ok(k.betaling > k.antal * L.VARE[k.vare].pris * 1.6);
});
test('udløbet kontrakt koster omdømme; højst 3 aktive', function () {
  var g = nyt(); rolig(g);
  var t = g.tilbud(); g.tagKontrakt(t[0].id);
  var frist = g.state.kontrakter[0].frist; while (g.state.dag <= frist) g.vent();
  assert.strictEqual(g.state.kontrakter.length, 0); assert.strictEqual(g.state.omdoemme.vega, 2);
  var h = nyt(); h.fornyTilbud('kepler'); var a = h.tilbud().slice(); a.forEach(function (k) { h.tagKontrakt(k.id); });
  h.fornyTilbud('kepler'); assert.strictEqual(h.tagKontrakt(h.tilbud()[0].id).grund, 'fuld');
});
test('omdømme åbner låste planeter og giver rabat', function () {
  var g = nyt(), p = g.pris('mad').koeb;
  g.state.omdoemme.vega = 100; assert.ok(g.pris('mad').koeb < p); assert.ok(g.adgang('altair'));
});

// ---------- Gæld og game over ----------
test('månedens regning forfalder hver 30. dag og vokser', function () {
  var g = nyt(); rolig(g); g.state.kredit = 1e6;
  assert.strictEqual(g.naesteForfald(), 30);
  var r1 = g.regning(); assert.strictEqual(r1.total, r1.renter + r1.afdrag + r1.licens + r1.drift + r1.forsikring);
  assert.strictEqual(r1.renter, 150, 'halv rente i startperioden'); assert.strictEqual(r1.afdrag, 0, 'afdragsfri i startperioden'); assert.ok(r1.start);
  while (g.state.dag < 30) g.vent();
  assert.strictEqual(g.state.maaneder, 1); assert.strictEqual(g.state.gaeld, 6000 - r1.afdrag);
  assert.strictEqual(g.naesteForfald(), 60);
  var regninger = [r1.afdrag + r1.licens]; for (var m = 0; m < 6; m++) { var r = g.regning(); regninger.push(r.afdrag + r.licens); g._forfald(); }
  for (var i = 1; i < regninger.length; i++) assert.ok(regninger[i] > regninger[i - 1], 'vokser');
});
test('flere skibe og bygninger giver driftsudgifter og forsikring koster', function () {
  var g = nyt(); g.state.kredit = 1e5; var r0 = g.regning().total;
  g.koebSkib('spurv'); g.byg('mine'); assert.strictEqual(g.regning().total, r0 + 150 + 120);
  g.saetForsikring(true); assert.strictEqual(g.regning().forsikring, 250);
});
test('afdrag og lån', function () {
  var g = nyt(); g.betalAf(1000); assert.strictEqual(g.state.gaeld, 5000); assert.strictEqual(g.state.kredit, 1500);
  assert.ok(g.laan(2000).ok); assert.strictEqual(g.state.gaeld, 7000);
  g.state.gaeld = 40000; assert.strictEqual(g.laan(2000).ok, false);
});
test('konkurs, når regningen ikke kan betales = game over', function () {
  var g = nyt(); g.state.kredit = 10;
  while (!g.state.over) g.vent();
  assert.strictEqual(g.state.grund, 'konkurs'); assert.strictEqual(g.state.dag, 30);
  assert.strictEqual(g.vent().ok, false); assert.strictEqual(g.flyv('vega').ok, false);
});
test('passiv spiller går konkurs inden for få måneder', function () {
  var g = nyt(); while (!g.state.over) g.vent();
  assert.ok(g.state.dag > 90 && g.state.dag <= 180, 'dag ' + g.state.dag);
});
test('startperioden: de første 3 regninger er afdragsfri med halv rente, derefter fuld regning', function () {
  var g = nyt(); rolig(g); g.state.kredit = 1e6;
  for (var m = 1; m <= 3; m++) { var r = g.regning(); assert.ok(r.start); assert.strictEqual(r.afdrag, 0); assert.strictEqual(r.renter, Math.round(g.state.gaeld * L.RENTE * L.START_RENTE_ANDEL)); g._forfald(); }
  assert.strictEqual(g.state.gaeld, 6000, 'ingen afdrag de første 90 dage');
  var r4 = g.regning(); assert.ok(!r4.start); assert.strictEqual(r4.afdrag, 250); assert.strictEqual(r4.renter, 300);
});
test('nettoformue inkl. skibe og bygninger', function () {
  var g = nyt(); assert.strictEqual(g.nettoformue(), 2500 - 6000 + 3000);
  g.state.kredit = 50000; var f = g.nettoformue(); g.koebSkib('pelikan');
  assert.strictEqual(g.nettoformue(), f - 8000 + 4800);
});
test('point = endelig nettoformue ved pension (ikke den højeste undervejs)', function () {
  var g = nyt(); rolig(g); g.state.kredit = 50000; g.vent();
  var hoej = g.point(); assert.strictEqual(hoej, g.nettoformue(), 'mens spillet kører: point hvis du går på pension nu');
  g.state.kredit = 20000; var n = g.nettoformue(); assert.ok(n < hoej);
  assert.ok(g.pension().ok); assert.ok(g.state.over); assert.strictEqual(g.state.grund, 'pension');
  assert.strictEqual(g.point(), n, 'slutformuen tæller, ikke toppen');
  g.state.kredit = 0; assert.strictEqual(g.point(), n, 'point ændrer sig ikke efter slut');
});
test('konkurs straffes: kun 25 % af slutformuen, aldrig under 0', function () {
  var g = nyt(); g.state.kredit = 100; g.byg('lager'); g.state.bygninger.kepler = { lager: 4, varer: { luksus: 200 } };
  g.state.gaeld = 0;
  while (!g.state.over) g.vent();
  assert.strictEqual(g.state.grund, 'konkurs');
  assert.ok(g.state.slutFormue > 0);
  assert.strictEqual(g.point(), Math.round(g.state.slutFormue * L.KONKURS_ANDEL));
  var h = nyt(); h.state.kredit = 10; while (!h.state.over) h.vent();
  assert.ok(h.state.slutFormue < 0); assert.strictEqual(h.point(), 0);
});
test('gem og genindlæs giver samme spil', function () {
  var g = nyt(11); rolig(g); g.koeb('mad', 5); g.flyv('vega');
  var h = L.createGame(JSON.parse(JSON.stringify(g.save())));
  assert.deepStrictEqual(h.state, g.state);
  g.vent(); h.vent(); assert.deepStrictEqual(h.state, g.state, 'samme tilfældighed efter genindlæsning');
});
test('spillet er endeløst: en dygtig handlende kan overleve et år', function () {
  process.env.DBG = '1'; var S = require('./simulering.js');
  var g = nyt(1001); while (!g.state.over && g.state.dag < 365) S.imperium(g);
  assert.ok(!g.state.over, 'overlevede'); assert.ok(g.nettoformue() > 20000);
});
console.log('\n' + n + ' tests bestået');
