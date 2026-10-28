/*
 * Kaperen – spillogik. Ingen DOM, ingen farver, ingen grafik og ingen tekster
 * ud over navnene på havne, varer og skibe. Alt er turbaseret og styres af en
 * fast tilfældighedsgenerator (seed), så spillet kan gemmes og testes.
 *
 *   var g = KaperenLogik.createGame({ seed: 7 });   // eller createGame(gemtTilstand)
 *   g.pris('rom')              -> { koeb, salg, niveau: 'billig' | 'normal' | 'dyr' }
 *   g.koeb('rom', 5 | 'alt')   g.saelg('rom', 1 | 5 | 'alt')
 *   g.rejseInfo('rubinhavn')   g.sejl('rubinhavn')   -> { dage, moede, sult }
 *   g.handling('skyd' | 'naermere' | 'bord' | 'flygt')   (møde med et skib)
 *   g.storm('ride' | 'laa')    g.ankom()
 *   g.reparer(n | 'alt')  g.koebKanon()  g.opgrader('sejl' | 'lastrum')  g.koebSkib()
 *   g.hyr(n | 'alt')  g.proviant(n | 'fyld')  g.rygte()
 *   g.formue()  g.point()  g.gaaILand()  g.save()
 */
(function (global) {
  'use strict';

  var VARER = [
    { id: 'rom', navn: 'Rom', pris: 30 },
    { id: 'sukker', navn: 'Sukker', pris: 18 },
    { id: 'krydderier', navn: 'Krydderier', pris: 55 },
    { id: 'tobak', navn: 'Tobak', pris: 40 },
    { id: 'silke', navn: 'Silke', pris: 95 }
  ];
  // Havnene ligger i tre rækker på kortet (x og y fra 0 til 1), så de store
  // knapper aldrig overlapper. Kortets bredde regnes som 1,6 × højden.
  var HAVNE = [
    { id: 'kongshavn', navn: 'Kongshavn', x: 1 / 6, y: 0.17, billig: ['silke'], dyr: ['rom', 'sukker'], flaade: true },
    { id: 'rubinhavn', navn: 'Rubinhavn', x: 3 / 6, y: 0.15, billig: ['krydderier'], dyr: ['silke'] },
    { id: 'palmebugt', navn: 'Palmebugt', x: 5 / 6, y: 0.19, billig: ['rom', 'sukker'], dyr: ['krydderier'] },
    { id: 'taageskaer', navn: 'Tågeskær', x: 2 / 6, y: 0.5, billig: ['tobak'], dyr: ['sukker', 'silke'] },
    { id: 'soelvbyen', navn: 'Sølvbyen', x: 4 / 6, y: 0.52, billig: ['rom'], dyr: ['krydderier', 'tobak'] },
    { id: 'saltkyst', navn: 'Saltkyst', x: 1 / 6, y: 0.83, billig: ['tobak'], dyr: ['rom'] },
    { id: 'ankerholm', navn: 'Ankerholm', x: 3 / 6, y: 0.85, billig: ['krydderier', 'silke'], dyr: ['tobak'] },
    { id: 'ravnsoe', navn: 'Ravnsø', x: 5 / 6, y: 0.81, billig: ['sukker'], dyr: ['tobak', 'silke'], skjul: true }
  ];
  var SKIBE = [
    { id: 'slup', navn: 'Slup', last: 20, skrog: 60, kanoner: 6, mandskab: 16, fart: 4, pris: 0 },
    { id: 'brig', navn: 'Brig', last: 40, skrog: 100, kanoner: 12, mandskab: 32, fart: 4, pris: 3000 },
    { id: 'fregat', navn: 'Fregat', last: 60, skrog: 160, kanoner: 20, mandskab: 56, fart: 4, pris: 8000 },
    { id: 'galeon', navn: 'Galeon', last: 100, skrog: 230, kanoner: 26, mandskab: 80, fart: 3, pris: 16000 }
  ];
  var FAKTOR = { billig: 0.6, normal: 1, dyr: 1.55 };
  var SALG = 0.88;               // man får 88 % af købsprisen, når man sælger
  var KANON_PRIS = 120;
  var SEJL_PRIS = [400, 900, 1800];     // niveau 1, 2 og 3
  var LASTRUM_PRIS = [300, 700, 1500];
  var REPARATION = 3;            // guld pr. skrogpoint
  var PROVIANT_MAX = 40;
  var TRAEF = [0.85, 0.7, 0.5, 0.3];    // chance for at ramme pr. kanon ved afstand 0–3
  var AFSTANDE = 4;              // 0 = side om side (bord), 3 = langt væk; 4 = væk
  var START = { guld: 300, kanoner: 2, mandskab: 8, proviant: 12, havn: 'taageskaer', skib: 'slup' };

  // ---------- Tilfældighed (mulberry32, tilstanden gemmes) ----------
  function rng(st) {
    st.seed = (st.seed + 0x6D2B79F5) | 0;
    var t = st.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rint(st, a, b) { return a + Math.floor(rng(st) * (b - a + 1)); }
  function rfloat(st, a, b) { return a + rng(st) * (b - a); }
  function vaelg(st, arr) { return arr[Math.floor(rng(st) * arr.length)]; }
  function vaegtet(st, w) {
    var sum = 0, k; for (k in w) sum += w[k];
    var r = rng(st) * sum;
    for (k in w) { r -= w[k]; if (r < 0) return k; }
    return k;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function havnById(id) { for (var i = 0; i < HAVNE.length; i++) if (HAVNE[i].id === id) return HAVNE[i]; return null; }
  function vareById(id) { for (var i = 0; i < VARER.length; i++) if (VARER[i].id === id) return VARER[i]; return null; }
  function skibById(id) { for (var i = 0; i < SKIBE.length; i++) if (SKIBE[i].id === id) return SKIBE[i]; return SKIBE[0]; }
  function skibIndex(id) { for (var i = 0; i < SKIBE.length; i++) if (SKIBE[i].id === id) return i; return 0; }
  function afstand(a, b) {
    var A = havnById(a), B = havnById(b);
    var dx = (A.x - B.x) * 1.6, dy = A.y - B.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function niveauI(havn, vare) {
    if (havn.billig.indexOf(vare) >= 0) return 'billig';
    if (havn.dyr.indexOf(vare) >= 0) return 'dyr';
    return 'normal';
  }
  function tomLast() { var o = {}; VARER.forEach(function (v) { o[v.id] = 0; }); return o; }

  var SKIBSNAVNE = ['Maja', 'Havfruen', 'Sankt Anna', 'Nordstjernen', 'Ørnen', 'Freja', 'Lykken', 'Tre Søstre', 'Mågen', 'Delfinen', 'Svanen', 'Haabet'];
  var PIRATNAVNE = ['Sorte Hugo', 'Den Røde Ravn', 'Knivbjørn', 'Enøjede Else', 'Kaptajn Krog', 'Saltmund', 'Grå Gerda', 'Lange Lars'];

  function createGame(init) {
    init = init || {};
    var st;
    if (init.havn && init.skib) {
      st = JSON.parse(JSON.stringify(init));
    } else {
      st = {
        version: 1, seed: (init.seed !== undefined ? init.seed : Math.floor(Math.random() * 1e9)) | 0,
        dag: 1, guld: START.guld, havn: START.havn, skib: START.skib,
        skrog: skibById(START.skib).skrog, kanoner: START.kanoner, mandskab: START.mandskab,
        proviant: START.proviant, sejl: 0, lastrum: 0, investeret: START.kanoner * KANON_PRIS,
        last: tomLast(), betalt: tomLast(), beroemmelse: 0, priser: {}, besoeg: {},
        rejse: null, moede: null, over: null,
        tal: { rejser: 0, kapret: 0, sænket: 0, flygtet: 0, handel: 0 }
      };
      HAVNE.forEach(function (h) { st.priser[h.id] = nyePriser(h); });
      st.besoeg[st.havn] = 1;
    }

    function nyePriser(h) {
      var p = {};
      VARER.forEach(function (v) { p[v.id] = Math.round(FAKTOR[niveauI(h, v.id)] * rfloat(st, 0.8, 1.25) * 1000) / 1000; });
      return p;
    }

    // ---------- Skibet ----------
    function type() { return skibById(st.skib); }
    function lastrum() { return Math.round(type().last * (1 + 0.25 * st.lastrum)); }
    function lastIalt() { var n = 0; VARER.forEach(function (v) { n += st.last[v.id]; }); return n; }
    function fri() { return lastrum() - lastIalt(); }
    function fart() { return type().fart + st.sejl; }
    function maxSkrog() { return type().skrog; }
    function maxMandskab() { return type().mandskab; }
    function effKanoner() { return Math.min(st.kanoner, Math.floor(st.mandskab / 2)); }
    function niveau() { return 1 + Math.floor((st.dag - 1) / 25) + Math.floor(st.beroemmelse / 15); }

    // ---------- Marked ----------
    function pris(vare, havnId) {
      var h = havnById(havnId || st.havn), v = vareById(vare);
      var f = st.priser[h.id][vare];
      var koeb = Math.max(1, Math.round(v.pris * f));
      var rel = koeb / v.pris;
      return { koeb: koeb, salg: Math.max(1, Math.round(koeb * SALG)), niveau: rel <= 0.8 ? 'billig' : rel >= 1.25 ? 'dyr' : 'normal' };
    }
    function kanHandle() { return !st.over && !st.rejse; }
    function koeb(vare, n) {
      if (!kanHandle() || !vareById(vare)) return { ok: false, grund: 'ikke-i-havn' };
      var max = n === 'alt' ? Infinity : n, antal = 0, betalt = 0;
      while (antal < max) {
        if (fri() <= 0) break;
        var p = pris(vare).koeb;
        if (p > st.guld) break;
        st.guld -= p; st.last[vare]++; st.betalt[vare] += p; betalt += p; antal++;
        st.priser[st.havn][vare] = Math.round(st.priser[st.havn][vare] * 1.01 * 1000) / 1000;
      }
      if (antal === 0) return { ok: false, grund: fri() <= 0 ? 'fuldt' : 'guld', mangler: pris(vare).koeb - st.guld };
      st.tal.handel++;
      return { ok: true, antal: antal, betalt: betalt, grund: antal < max ? (fri() <= 0 ? 'fuldt' : 'guld') : null };
    }
    function saelg(vare, n) {
      if (!kanHandle() || !vareById(vare)) return { ok: false, grund: 'ikke-i-havn' };
      if (st.last[vare] <= 0) return { ok: false, grund: 'ingen' };
      var max = n === 'alt' ? st.last[vare] : Math.min(n, st.last[vare]), antal = 0, faaet = 0;
      while (antal < max) {
        var p = pris(vare).salg, gns = st.last[vare] ? st.betalt[vare] / st.last[vare] : 0;
        st.guld += p; faaet += p; antal++;
        st.betalt[vare] = Math.max(0, st.betalt[vare] - gns); st.last[vare]--;
        st.priser[st.havn][vare] = Math.round(Math.max(0.3, st.priser[st.havn][vare] * 0.99) * 1000) / 1000;
      }
      if (!st.last[vare]) st.betalt[vare] = 0;
      st.tal.handel++;
      return { ok: true, antal: antal, faaet: faaet };
    }
    function gnsKoebt(vare) { return st.last[vare] ? Math.round(st.betalt[vare] / st.last[vare]) : 0; }

    // ---------- Værft ----------
    function reparationPris(n) { return n * REPARATION; }
    function reparer(n) {
      if (!kanHandle()) return { ok: false };
      var mangler = maxSkrog() - st.skrog;
      if (mangler <= 0) return { ok: false, grund: 'helt' };
      var want = n === 'alt' ? mangler : Math.min(n, mangler);
      var kan = Math.min(want, Math.floor(st.guld / REPARATION));
      if (kan <= 0) return { ok: false, grund: 'guld', mangler: REPARATION - st.guld };
      st.guld -= kan * REPARATION; st.skrog += kan;
      return { ok: true, antal: kan, pris: kan * REPARATION };
    }
    function kanonPris() { return st.kanoner >= type().kanoner ? null : KANON_PRIS; }
    function koebKanon() {
      if (!kanHandle()) return { ok: false };
      var p = kanonPris();
      if (p === null) return { ok: false, grund: 'max' };
      if (st.guld < p) return { ok: false, grund: 'guld', mangler: p - st.guld };
      st.guld -= p; st.kanoner++; st.investeret += p;
      return { ok: true, pris: p };
    }
    function opgraderPris(hvad) {
      var lv = st[hvad], tab = hvad === 'sejl' ? SEJL_PRIS : LASTRUM_PRIS;
      return lv >= tab.length ? null : tab[lv];
    }
    function opgrader(hvad) {
      if (!kanHandle() || (hvad !== 'sejl' && hvad !== 'lastrum')) return { ok: false };
      var p = opgraderPris(hvad);
      if (p === null) return { ok: false, grund: 'max' };
      if (st.guld < p) return { ok: false, grund: 'guld', mangler: p - st.guld };
      st.guld -= p; st[hvad]++; st.investeret += p;
      return { ok: true, pris: p, niveau: st[hvad] };
    }
    function skibsvaerdi() { return Math.round(0.5 * (type().pris + st.investeret)); }
    function naesteSkib() {
      var i = skibIndex(st.skib);
      if (i >= SKIBE.length - 1) return null;
      var ny = SKIBE[i + 1];
      // Det gamle skrog tages i bytte for halvdelen af nyprisen
      return { skib: ny, pris: Math.max(0, ny.pris - Math.round(type().pris * 0.5)) };
    }
    function koebSkib() {
      if (!kanHandle()) return { ok: false };
      var n = naesteSkib();
      if (!n) return { ok: false, grund: 'max' };
      if (st.guld < n.pris) return { ok: false, grund: 'guld', mangler: n.pris - st.guld };
      st.guld -= n.pris; st.skib = n.skib.id; st.skrog = n.skib.skrog;
      st.kanoner = Math.min(st.kanoner, n.skib.kanoner); st.mandskab = Math.min(st.mandskab, n.skib.mandskab);
      return { ok: true, pris: n.pris, skib: n.skib };
    }

    // ---------- Værtshus ----------
    function hyrePris() { var h = havnById(st.havn); return h.skjul ? 10 : h.flaade ? 18 : 14; }
    function hyr(n) {
      if (!kanHandle()) return { ok: false };
      var plads = maxMandskab() - st.mandskab;
      if (plads <= 0) return { ok: false, grund: 'fuldt' };
      var want = n === 'alt' ? plads : Math.min(n, plads), p = hyrePris();
      var kan = Math.min(want, Math.floor(st.guld / p));
      if (kan <= 0) return { ok: false, grund: 'guld', mangler: p - st.guld };
      st.guld -= kan * p; st.mandskab += kan;
      return { ok: true, antal: kan, pris: kan * p };
    }
    function proviantPris() { return 1 + Math.ceil(st.mandskab / 4); }
    function proviant(n) {
      if (!kanHandle()) return { ok: false };
      var plads = PROVIANT_MAX - st.proviant;
      if (plads <= 0) return { ok: false, grund: 'fuldt' };
      var want = (n === 'fyld' || n === 'alt') ? plads : Math.min(n, plads), p = proviantPris();
      var kan = Math.min(want, Math.floor(st.guld / p));
      if (kan <= 0) return { ok: false, grund: 'guld', mangler: p - st.guld };
      st.guld -= kan * p; st.proviant += kan;
      return { ok: true, antal: kan, pris: kan * p };
    }
    // Et rygte om en god pris et andet sted (bedste salg af en vare, man kan købe billigt her)
    function rygte() {
      var bedst = null;
      VARER.forEach(function (v) {
        var her = pris(v.id).koeb;
        HAVNE.forEach(function (h) {
          if (h.id === st.havn) return;
          var s = pris(v.id, h.id).salg, gevinst = s - her;
          if (!bedst || gevinst > bedst.gevinst) bedst = { vare: v.id, havn: h.id, salg: s, koeb: her, gevinst: gevinst };
        });
      });
      return bedst;
    }

    // ---------- Rejse ----------
    function rejseDage(til) { return Math.max(1, Math.ceil(afstand(st.havn, til) * 14 / fart())); }
    function rejseInfo(til) {
      var d = rejseDage(til);
      return { dage: d, proviant: d, nok: st.proviant >= d, havn: havnById(til) };
    }
    function sejl(til) {
      if (st.over || st.rejse || !havnById(til) || til === st.havn) return null;
      var dage = rejseDage(til);
      st.rejse = { fra: st.havn, til: til, dage: dage };
      st.dag += dage; st.tal.rejser++;
      var sult = spis(dage);
      if (st.over) return { dage: dage, moede: null, sult: sult };
      // Et møde undervejs?
      var moede = null;
      var chance = Math.min(0.8, 0.3 + 0.1 * dage);
      if (rng(st) < chance) {
        var flaade = havnById(til).flaade || havnById(st.havn).flaade, skjul = havnById(til).skjul || havnById(st.havn).skjul;
        var w = { handel: 35, pirat: 28 + (skjul ? 22 : 0), marine: 6 + st.beroemmelse * 0.6 + (flaade ? 15 : 0), storm: 14 };
        var slags = vaegtet(st, w);
        moede = slags === 'storm' ? { slags: 'storm', dagNr: rint(st, 1, dage) } : nytSkib(slags);
        moede.dagNr = rint(st, 1, dage);
      }
      st.moede = moede;
      return { dage: dage, moede: moede, sult: sult };
    }
    // Proviant pr. dag. Mangler der, mister man folk hver dag uden mad.
    function spis(dage) {
      var tab = 0, uden = 0;
      for (var d = 0; d < dage; d++) {
        if (st.proviant > 0) st.proviant--;
        else { uden++; var t = Math.max(1, Math.ceil(st.mandskab * 0.15)); t = Math.min(t, st.mandskab); st.mandskab -= t; tab += t; }
      }
      if (st.mandskab <= 0) slut('sult');
      return uden ? { dage: uden, tab: tab } : null;
    }
    function ankom() {
      if (st.over || !st.rejse) return false;
      if (st.moede && !st.moede.slut) return false;
      var til = st.rejse.til;
      st.havn = til; st.rejse = null; st.moede = null;
      st.besoeg[til] = (st.besoeg[til] || 0) + 1;
      // Priserne ændrer sig over tid: havnen, man kommer til, får nye priser,
      // og de andre havne glider lidt.
      st.priser[til] = nyePriser(havnById(til));
      HAVNE.forEach(function (h) {
        if (h.id === til) return;
        VARER.forEach(function (v) {
          var base = FAKTOR[niveauI(h, v.id)], f = st.priser[h.id][v.id];
          f = f + (base - f) * 0.25 + base * rfloat(st, -0.06, 0.06);
          st.priser[h.id][v.id] = Math.round(clamp(f, base * 0.6, base * 1.4) * 1000) / 1000;
        });
      });
      return true;
    }

    // ---------- Møder ----------
    function nytSkib(slags) {
      var lv = niveau(), m;
      if (slags === 'handel') {
        m = { skrog: 45 + 12 * lv, kanoner: rint(st, 0, 2) + Math.floor(lv / 2), mandskab: 6 + 2 * lv, fart: 3, guld: rint(st, 40, 150) * lv, navn: vaelg(st, SKIBSNAVNE), fjendtlig: false };
        m.last = lastTil(rint(st, 8, 18) * lv, rint(st, 1, 3));
      } else if (slags === 'pirat') {
        m = { skrog: 40 + 15 * lv, kanoner: 2 + lv, mandskab: 8 + 4 * lv, fart: 4 + (lv > 2 ? 1 : 0), guld: rint(st, 80, 200) * lv, navn: vaelg(st, PIRATNAVNE), fjendtlig: true };
        m.last = lastTil(rint(st, 0, 8) * lv, 1);
      } else {
        m = { skrog: 120 + 30 * lv, kanoner: 8 + 2 * lv, mandskab: 28 + 6 * lv, fart: 5, guld: 250 * lv, navn: vaelg(st, ['Kronborg', 'Dannebrog', 'Løven', 'Prins Frederik', 'Elefanten']), fjendtlig: st.beroemmelse >= 10 };
        m.last = tomLast();
      }
      m.slags = slags; m.niveau = lv; m.maxSkrog = m.skrog; m.afstand = rint(st, 2, 3);
      m.provokeret = false; m.runde = 1; m.slut = null; m.haendelser = []; m.bytte = null;
      m.skibstype = slags === 'marine' ? 'fregat' : slags === 'handel' ? (lv >= 3 ? 'brig' : 'slup') : (lv >= 2 ? 'brig' : 'slup');
      return m;
    }
    function lastTil(n, varer) {
      var l = tomLast();
      for (var i = 0; i < varer && n > 0; i++) {
        var v = vaelg(st, VARER).id, k = i === varer - 1 ? n : rint(st, 1, n);
        l[v] += k; n -= k;
      }
      return l;
    }
    function erFjendtlig(m) { return m.fjendtlig || m.provokeret; }
    function traefChance(d) { return TRAEF[clamp(d, 0, 3)]; }
    function skud(antal, d) {
      var traef = 0, skade = 0;
      for (var i = 0; i < antal; i++) if (rng(st) < traefChance(d)) { traef++; skade += rint(st, 3, 7); }
      return { kanoner: antal, traef: traef, skade: skade };
    }
    function flugtChance(m) {
      if (!erFjendtlig(m)) return 1;
      return clamp(0.35 + 0.15 * (fart() - m.fart) + 0.12 * m.afstand, 0.1, 0.95);
    }
    function naermereChance(m) {
      if (!erFjendtlig(m) || m.fjendtlig) return 1;  // fjenden vil selv tæt på
      return clamp(0.55 + 0.12 * (fart() - m.fart), 0.2, 0.95);
    }
    function bordChance(m) {
      var mine = st.mandskab, deres = m.mandskab * (m.skrog < m.maxSkrog / 2 ? 0.8 : 1);
      if (mine + deres <= 0) return 0;
      return clamp(mine / (mine + deres) * 1.0 + (mine > deres ? 0.1 : -0.1), 0.05, 0.95);
    }
    // Kamp om bord: den med flest folk (plus held) vinder
    function bordkamp(m, angriber) {
      var mine = st.mandskab * rfloat(st, 0.75, 1.25) * (angriber === 'fjende' ? 1.1 : 1);
      var deres = m.mandskab * rfloat(st, 0.75, 1.25) * (m.skrog < m.maxSkrog / 2 ? 0.8 : 1);
      var vandt = mine >= deres;
      var tab;
      if (vandt) {
        tab = Math.min(st.mandskab - 1, Math.max(1, Math.round(m.mandskab * 0.3 * rfloat(st, 0.5, 1.2))));
        st.mandskab -= Math.max(0, tab);
      } else {
        tab = Math.max(1, Math.round(st.mandskab * 0.4));
        st.mandskab = Math.max(m.slags === 'marine' ? 0 : 1, st.mandskab - tab);
      }
      return { vandt: vandt, tab: tab };
    }
    function berom(m, hvordan) {
      var b = m.slags === 'marine' ? 10 + m.niveau : m.slags === 'pirat' ? 3 + m.niveau : 2;
      if (hvordan === 'sænket') b = Math.max(1, Math.round(b * 0.7));
      st.beroemmelse += b;
      return b;
    }
    function kapr(m) {
      var plads = fri(), fik = tomLast(), tabt = 0;
      VARER.forEach(function (v) {
        var k = Math.min(m.last[v.id], plads);
        st.last[v.id] += k; fik[v.id] = k; plads -= k; tabt += m.last[v.id] - k;
      });
      st.guld += m.guld;
      st.tal.kapret++;
      m.bytte = { guld: m.guld, last: fik, efterladt: tabt, beroemmelse: berom(m, 'kapret') };
      m.slut = 'kapret';
    }
    function saenk(m) {
      var g = Math.round(m.guld * 0.3);
      st.guld += g; st.tal.sænket++;
      m.bytte = { guld: g, last: tomLast(), efterladt: 0, beroemmelse: berom(m, 'sænket') };
      m.slut = 'sænket';
    }
    function tabtBordkamp(m, h) {
      if (m.slags === 'marine') { m.slut = 'taget'; slut('taget'); return; }
      if (m.slags === 'pirat') {
        var tog = { guld: Math.round(st.guld * 0.5), last: JSON.parse(JSON.stringify(st.last)) };
        st.guld -= tog.guld; st.last = tomLast(); st.betalt = tomLast();
        h.plyndret = tog; m.slut = 'plyndret';
      } else { m.slut = 'afvist'; }
    }
    // Spillerens valg i en runde. Bagefter handler det andet skib (hvis mødet ikke er slut).
    function handling(valg) {
      var m = st.moede;
      if (!m || m.slut || m.slags === 'storm' || st.over) return null;
      var h = { runde: m.runde, valg: valg, spiller: null, fjende: null };
      if (valg === 'skyd') {
        var s = skud(effKanoner(), m.afstand);
        if (s.kanoner === 0) return { fejl: 'ingen-kanoner' };
        m.skrog = Math.max(0, m.skrog - s.skade);
        h.spiller = { type: 'skud', skud: s };
        m.provokeret = true;
        if (m.skrog <= 0) saenk(m);
      } else if (valg === 'naermere') {
        if (m.afstand <= 0) return { fejl: 'helt-taet' };
        var ok = rng(st) < naermereChance(m);
        if (ok) m.afstand--;
        h.spiller = { type: 'naermere', ok: ok };
      } else if (valg === 'bord') {
        if (m.afstand > 0) return { fejl: 'for-langt' };
        m.provokeret = true;
        var b = bordkamp(m, 'spiller');
        h.spiller = { type: 'bord', vandt: b.vandt, tab: b.tab };
        if (b.vandt) kapr(m); else tabtBordkamp(m, h);
        if (!m.slut && st.mandskab <= 0) { m.slut = 'tabt'; slut('mandskab'); }
      } else if (valg === 'flygt') {
        var fred = !erFjendtlig(m);
        var ok2 = rng(st) < flugtChance(m);
        h.spiller = { type: fred ? 'videre' : 'flygt', ok: ok2 };
        if (ok2) { m.slut = fred ? 'videre' : 'flygtet'; if (!fred) st.tal.flygtet++; }
      } else return { fejl: 'ukendt' };
      if (!m.slut && !st.over) h.fjende = fjendeTur(m, h);
      m.haendelser.push(h);
      if (m.haendelser.length > 6) m.haendelser.shift();
      m.runde++;
      return h;
    }
    function fjendeTur(m, h) {
      var t = { type: 'venter' };
      if (!erFjendtlig(m)) return t;
      var flygter = m.slags === 'handel' || (m.slags === 'pirat' && m.skrog < m.maxSkrog * 0.3);
      if (flygter) {
        var ok = rng(st) < clamp(0.45 + 0.12 * (m.fart - fart()), 0.1, 0.9);
        if (ok) m.afstand++;
        t = { type: 'flygter', ok: ok };
        if (m.afstand >= AFSTANDE) { m.slut = 'undsluppet'; return t; }
        if (m.kanoner > 0) { t.skud = skud(m.kanoner, m.afstand); st.skrog = Math.max(0, st.skrog - t.skud.skade); }
      } else if (m.afstand === 0 && m.mandskab >= st.mandskab * 1.1) {
        var b = bordkamp(m, 'fjende');
        t = { type: 'bord', vandt: !b.vandt, tab: b.tab };   // vandt = fjenden vandt
        if (b.vandt) {
          // Spilleren forsvarede sig og tog skibet
          kapr(m);
        } else tabtBordkamp(m, h);
        if (!st.over && st.mandskab <= 0) { m.slut = 'tabt'; slut('mandskab'); }
        return t;
      } else {
        if (m.afstand >= 1 && (m.afstand >= 2 || m.mandskab >= st.mandskab * 1.3)) { m.afstand--; t.naermere = true; }
        t.type = 'skud';
        t.skud = skud(m.kanoner, m.afstand);
        st.skrog = Math.max(0, st.skrog - t.skud.skade);
      }
      if (st.skrog <= 0) { m.slut = 'sunket'; slut('sunket'); }
      return t;
    }
    function storm(valg) {
      var m = st.moede;
      if (!m || m.slags !== 'storm' || m.slut || st.over) return null;
      var r = { valg: valg };
      if (valg === 'laa') {
        r.dage = 2; st.dag += 2; r.sult = spis(2);
        r.skade = Math.min(st.skrog, rint(st, 0, 4));
      } else {
        r.skade = Math.round(maxSkrog() * rfloat(st, 0.1, 0.28));
      }
      st.skrog = Math.max(0, st.skrog - r.skade);
      m.resultat = r;
      m.slut = 'overstaaet';
      if (st.skrog <= 0) slut('storm');
      return r;
    }

    // ---------- Slut og point ----------
    function lastVaerdi() { var s = 0; VARER.forEach(function (v) { s += st.last[v.id] * v.pris; }); return s; }
    function formue() { return st.guld + lastVaerdi() + (st.over && st.over.grund !== 'land' ? 0 : skibsvaerdi()); }
    function point() { return formue() + 10 * st.beroemmelse; }
    function slut(grund) {
      if (st.over) return st.over;
      st.over = { grund: grund };
      st.over.formue = formue(); st.over.point = point();
      st.over.dage = st.dag; st.over.skib = st.skib; st.over.beroemmelse = st.beroemmelse;
      return st.over;
    }
    function gaaILand() {
      if (st.over) return st.over;
      if (st.rejse) return null;
      return slut('land');
    }

    return {
      get state() { return st; },
      VARER: VARER, HAVNE: HAVNE, SKIBE: SKIBE,
      type: type, lastrum: lastrum, lastIalt: lastIalt, fri: fri, fart: fart, maxSkrog: maxSkrog,
      maxMandskab: maxMandskab, effKanoner: effKanoner, niveau: niveau,
      pris: pris, koeb: koeb, saelg: saelg, gnsKoebt: gnsKoebt,
      reparationPris: reparationPris, reparer: reparer, kanonPris: kanonPris, koebKanon: koebKanon,
      opgraderPris: opgraderPris, opgrader: opgrader, naesteSkib: naesteSkib, koebSkib: koebSkib, skibsvaerdi: skibsvaerdi,
      hyrePris: hyrePris, hyr: hyr, proviantPris: proviantPris, proviant: proviant, rygte: rygte,
      rejseDage: rejseDage, rejseInfo: rejseInfo, sejl: sejl, ankom: ankom,
      handling: handling, storm: storm, erFjendtlig: erFjendtlig,
      traefChance: traefChance, flugtChance: flugtChance, naermereChance: naermereChance, bordChance: bordChance,
      lastVaerdi: lastVaerdi, formue: formue, point: point, gaaILand: gaaILand, slut: slut,
      save: function () { return JSON.parse(JSON.stringify(st)); },
      _rng: function () { return rng(st); }
    };
  }

  global.KaperenLogik = {
    createGame: createGame, VARER: VARER, HAVNE: HAVNE, SKIBE: SKIBE, havnById: havnById, vareById: vareById,
    skibById: skibById, afstand: afstand, AFSTANDE: AFSTANDE, PROVIANT_MAX: PROVIANT_MAX, KANON_PRIS: KANON_PRIS,
    REPARATION: REPARATION, TRAEF: TRAEF, START: START
  };
})(typeof window !== 'undefined' ? window : globalThis);
