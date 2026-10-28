/*
 * Kaperen – spillogik. Ingen DOM, ingen farver, ingen grafik og ingen tekster
 * ud over navnene på havne, varer og skibe. Alt er turbaseret og styres af en
 * fast tilfældighedsgenerator (seed), så spillet kan gemmes og testes.
 *
 * v1.1: Havet er et gitter af felter (BREDDE × HOEJDE), som laves tilfældigt for
 * hvert spil. Man ser kun felterne inden for synsvidden og opdager havne, øer og
 * skibe ved at sejle rundt. Et felt er én dag og én dags proviant.
 *
 *   var g = KaperenLogik.createGame({ seed: 7 });   // eller createGame(gemtTilstand)
 *   g.pris('rom')              -> { koeb, salg, niveau: 'billig' | 'normal' | 'dyr' }
 *   g.koeb('rom', 5 | 'alt')   g.saelg('rom', 1 | 5 | 'alt')
 *   g.flyt(dx, dy)  g.vent()   -> { ok, sult, nyeHavne, havn, moede, nyeSkibe }
 *   g.saetKurs('rubinhavn')  g.autoTrin()  g.stopKurs()  g.kursInfo('rubinhavn')
 *   g.felt(x, y)  g.sett(x, y)  g.iSyn(x, y)  g.synligeSkibe()  g.synsvidde()
 *   g.handling('skyd' | 'naermere' | 'bord' | 'flygt')   (møde med et skib)
 *   g.storm('ride' | 'laa')    g.efterMoede()
 *   g.reparer(n | 'alt')  g.koebKanon()  g.opgrader('sejl' | 'lastrum')  g.koebSkib()  g.koebKikkert()
 *   g.hyr(n | 'alt')  g.proviant(n | 'fyld')  g.rygte()  g.rygteHavn()
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
  // Havnenes plads på havet findes tilfældigt for hvert spil; deres priser og
  // særpræg (flådehavn, piratskjul) er faste.
  var HAVNE = [
    { id: 'kongshavn', navn: 'Kongshavn', billig: ['silke'], dyr: ['rom', 'sukker'], flaade: true },
    { id: 'rubinhavn', navn: 'Rubinhavn', billig: ['krydderier'], dyr: ['silke'] },
    { id: 'palmebugt', navn: 'Palmebugt', billig: ['rom', 'sukker'], dyr: ['krydderier'] },
    { id: 'taageskaer', navn: 'Tågeskær', billig: ['tobak'], dyr: ['sukker', 'silke'] },
    { id: 'soelvbyen', navn: 'Sølvbyen', billig: ['rom'], dyr: ['krydderier', 'tobak'] },
    { id: 'saltkyst', navn: 'Saltkyst', billig: ['tobak'], dyr: ['rom'] },
    { id: 'ankerholm', navn: 'Ankerholm', billig: ['krydderier', 'silke'], dyr: ['tobak'] },
    { id: 'ravnsoe', navn: 'Ravnsø', billig: ['sukker'], dyr: ['tobak', 'silke'], skjul: true }
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
  var KIKKERT_PRIS = [250, 700];        // kikkert 1 og 2: synsvidde +1 og +2
  var RYGTE_PRIS = 25;                  // rygte om en ukendt havn
  var REPARATION = 3;            // guld pr. skrogpoint
  var PROVIANT_MAX = 40;
  var TRAEF = [0.85, 0.7, 0.5, 0.3];    // chance for at ramme pr. kanon ved afstand 0–3
  var AFSTANDE = 4;              // 0 = side om side (bord), 3 = langt væk; 4 = væk
  var START = { guld: 300, kanoner: 2, mandskab: 8, proviant: 12, havn: 'taageskaer', skib: 'slup' };
  var BREDDE = 24, HOEJDE = 15;  // havets felter
  var SYN = 2;                   // synsvidde i felter uden kikkert
  var STORM_CHANCE = 0.025;      // pr. dag til søs
  var BEROEMMELSE_FAKTOR = 50;   // point = formue + 50 × berømmelse (valgt ved simulering, se test/simulering.js)
  var RETNINGER = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

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
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  function havnById(id) { for (var i = 0; i < HAVNE.length; i++) if (HAVNE[i].id === id) return HAVNE[i]; return null; }
  function vareById(id) { for (var i = 0; i < VARER.length; i++) if (VARER[i].id === id) return VARER[i]; return null; }
  function skibById(id) { for (var i = 0; i < SKIBE.length; i++) if (SKIBE[i].id === id) return SKIBE[i]; return SKIBE[0]; }
  function skibIndex(id) { for (var i = 0; i < SKIBE.length; i++) if (SKIBE[i].id === id) return i; return 0; }
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
    if (init.version === 2 && init.felt && init.skib) {
      st = JSON.parse(JSON.stringify(init));
    } else if (init.skib && (init.havn || init.rejse)) {
      // Gemt spil fra v1 (fast kort): behold skib, last og guld, og læg skibet
      // i den havn, det lå i (eller sejlede fra) på et nyt, ukendt hav.
      st = JSON.parse(JSON.stringify(init));
      var her = (st.havn && havnById(st.havn)) ? st.havn : (st.rejse && havnById(st.rejse.fra) ? st.rejse.fra : START.havn);
      delete st.rejse;
      st.version = 2; st.havn = her; st.sidste = her; st.moede = null; st.kurs = null;
      st.kikkert = 0; st.skibe = []; st.naesteId = 1; st.migreret = true;
      st.tal = st.tal || {}; st.tal.felter = st.tal.felter || 0;
      HAVNE.forEach(function (h) { if (!st.priser || !st.priser[h.id]) { st.priser = st.priser || {}; st.priser[h.id] = nyePriser(h); } });
      lavVerden(her);
    } else {
      st = {
        version: 2, seed: (init.seed !== undefined ? init.seed : Math.floor(Math.random() * 1e9)) | 0,
        dag: 1, guld: START.guld, havn: START.havn, sidste: START.havn, skib: START.skib,
        skrog: skibById(START.skib).skrog, kanoner: START.kanoner, mandskab: START.mandskab,
        proviant: START.proviant, sejl: 0, lastrum: 0, kikkert: 0, investeret: START.kanoner * KANON_PRIS,
        last: tomLast(), betalt: tomLast(), beroemmelse: 0, priser: {}, besoeg: {},
        moede: null, over: null, kurs: null, skibe: [], naesteId: 1,
        tal: { rejser: 0, kapret: 0, sænket: 0, flygtet: 0, handel: 0, felter: 0 }
      };
      HAVNE.forEach(function (h) { st.priser[h.id] = nyePriser(h); });
      st.besoeg[st.havn] = 1;
      lavVerden(st.havn);
    }

    function nyePriser(h) {
      var p = {};
      VARER.forEach(function (v) { p[v.id] = Math.round(FAKTOR[niveauI(h, v.id)] * rfloat(st, 0.8, 1.25) * 1000) / 1000; });
      return p;
    }

    // ---------- Havet ----------
    // felt: streng med '0' (hav) og '1' (land); set: '1' for felter, man har set.
    function lavVerden(startId) {
      for (var forsoeg = 0; forsoeg < 400; forsoeg++) {
        var f = [], i, x, y;
        for (i = 0; i < BREDDE * HOEJDE; i++) f.push(0);
        var n = Math.max(0, rint(st, 13, 18) - Math.floor(forsoeg / 40));
        for (var k = 0; k < n; k++) {
          var cx = rint(st, 1, BREDDE - 2), cy = rint(st, 1, HOEJDE - 2);
          var rx = rfloat(st, 0.7, 2.6), ry = rfloat(st, 0.6, 1.9);
          for (y = cy - 3; y <= cy + 3; y++) for (x = cx - 3; x <= cx + 3; x++) {
            if (x < 0 || y < 0 || x >= BREDDE || y >= HOEJDE) continue;
            var v = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
            if (v <= 1 + rfloat(st, -0.3, 0.3)) f[y * BREDDE + x] = 1;
          }
        }
        var pos = placerHavne(f, startId, forsoeg > 300);
        if (!pos || !forbundet(f, pos, startId)) continue;
        st.felt = f.join('');
        st.havnePos = pos;
        st.pos = pos[startId].slice();
        st.set = new Array(BREDDE * HOEJDE + 1).join('0');
        st.kendt = {}; st.kendt[startId] = true;
        opdag();
        return;
      }
      throw new Error('kunne ikke lave et hav');
    }
    function placerHavne(f, startId, nød) {
      var kyst = [];
      for (var y = 1; y < HOEJDE - 1; y++) for (var x = 1; x < BREDDE - 1; x++) {
        if (f[y * BREDDE + x]) continue;
        var vedLand = f[(y - 1) * BREDDE + x] || f[(y + 1) * BREDDE + x] || f[y * BREDDE + x - 1] || f[y * BREDDE + x + 1];
        if (vedLand || nød) kyst.push([x, y]);
      }
      var midt = kyst.filter(function (p) { return p[0] >= BREDDE / 4 && p[0] <= BREDDE * 3 / 4 && p[1] >= HOEJDE / 4 && p[1] <= HOEJDE * 3 / 4; });
      if (!midt.length) return null;
      var pos = {}, sat = [];
      pos[startId] = vaelg(st, midt).slice(); sat.push(pos[startId]);
      var andre = HAVNE.map(function (h) { return h.id; }).filter(function (id) { return id !== startId; });
      for (var i = 0; i < andre.length; i++) {
        var fundet = null;
        for (var dmin = 6; dmin >= 4 && !fundet; dmin--) {
          var c = kyst.filter(function (p) { return sat.every(function (q) { return cheb(p[0], p[1], q[0], q[1]) >= dmin; }); });
          if (c.length) fundet = vaelg(st, c).slice();
        }
        if (!fundet) return null;
        pos[andre[i]] = fundet; sat.push(fundet);
      }
      return pos;
    }
    function forbundet(f, pos, startId) {
      var set = {}, ko = [pos[startId]], s0 = pos[startId];
      set[s0[1] * BREDDE + s0[0]] = 1;
      while (ko.length) {
        var p = ko.shift();
        for (var r = 0; r < 8; r++) {
          var x = p[0] + RETNINGER[r][0], y = p[1] + RETNINGER[r][1];
          if (x < 0 || y < 0 || x >= BREDDE || y >= HOEJDE || f[y * BREDDE + x]) continue;
          var i = y * BREDDE + x; if (set[i]) continue; set[i] = 1; ko.push([x, y]);
        }
      }
      for (var id in pos) if (!set[pos[id][1] * BREDDE + pos[id][0]]) return false;
      return true;
    }
    function ude(x, y) { return x < 0 || y < 0 || x >= BREDDE || y >= HOEJDE; }
    function erLand(x, y) { return ude(x, y) || st.felt.charAt(y * BREDDE + x) === '1'; }
    function havnVed(x, y) { for (var id in st.havnePos) { var p = st.havnePos[id]; if (p[0] === x && p[1] === y) return id; } return null; }
    function felt(x, y) { return ude(x, y) ? 'ude' : erLand(x, y) ? 'land' : havnVed(x, y) ? 'havn' : 'hav'; }
    function sett(x, y) { return !ude(x, y) && st.set.charAt(y * BREDDE + x) === '1'; }
    function synsvidde() { return SYN + (st.kikkert || 0); }
    function iSyn(x, y) {
      var dx = x - st.pos[0], dy = y - st.pos[1], r = synsvidde() + 0.5;
      return dx * dx + dy * dy <= r * r;
    }
    function opdag() {
      var r = synsvidde(), a = st.set.split(''), nye = [];
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var x = st.pos[0] + dx, y = st.pos[1] + dy;
        if (ude(x, y) || !iSyn(x, y)) continue;
        a[y * BREDDE + x] = '1';
        var h = havnVed(x, y);
        if (h && !st.kendt[h]) { st.kendt[h] = true; nye.push(h); }
      }
      st.set = a.join('');
      return nye;
    }
    function afsloer(x0, y0, r) {
      var a = st.set.split('');
      for (var y = y0 - r; y <= y0 + r; y++) for (var x = x0 - r; x <= x0 + r; x++) if (!ude(x, y)) a[y * BREDDE + x] = '1';
      st.set = a.join('');
    }
    function andelOpdaget() { var n = 0; for (var i = 0; i < st.set.length; i++) if (st.set.charAt(i) === '1') n++; return n / st.set.length; }
    function kendteHavne() { return HAVNE.filter(function (h) { return st.kendt[h.id]; }).map(function (h) { return h.id; }); }
    function havnePos(id) { return st.havnePos[id] ? st.havnePos[id].slice() : null; }
    function synligeSkibe() { return st.skibe.filter(function (s) { return iSyn(s.x, s.y); }); }
    function skibPaa(x, y) { for (var i = 0; i < st.skibe.length; i++) if (st.skibe[i].x === x && st.skibe[i].y === y) return st.skibe[i]; return null; }
    // ---------- Skibet ----------
    function type() { return skibById(st.skib); }
    function lastrum() { return Math.round(type().last * (1 + 0.25 * st.lastrum)); }
    function lastIalt() { var n = 0; VARER.forEach(function (v) { n += st.last[v.id]; }); return n; }
    function fri() { return lastrum() - lastIalt(); }
    function fart() { return type().fart + st.sejl; }
    function maxSkrog() { return type().skrog; }
    function maxMandskab() { return type().mandskab; }
    function effKanoner() { return Math.min(st.kanoner, Math.floor(st.mandskab / 2)); }
    function niveau() { return 1 + Math.floor((st.dag - 1) / 40) + Math.floor(st.beroemmelse / 15); }

    // ---------- Marked ----------
    function pris(vare, havnId) {
      var h = havnById(havnId || st.havn), v = vareById(vare);
      var f = st.priser[h.id][vare];
      var koeb = Math.max(1, Math.round(v.pris * f));
      var rel = koeb / v.pris;
      return { koeb: koeb, salg: Math.max(1, Math.round(koeb * SALG)), niveau: rel <= 0.8 ? 'billig' : rel >= 1.25 ? 'dyr' : 'normal' };
    }
    function kanHandle() { return !st.over && !!st.havn && !(st.moede && !st.moede.slut); }
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
    // Et rygte om en god pris i en havn, man kender (bedste salg af en vare, man kan købe her)
    function rygte() {
      var bedst = null;
      if (!st.havn) return null;
      VARER.forEach(function (v) {
        var her = pris(v.id).koeb;
        HAVNE.forEach(function (h) {
          if (h.id === st.havn || !st.kendt[h.id]) return;
          var s = pris(v.id, h.id).salg, gevinst = s - her;
          if (!bedst || gevinst > bedst.gevinst) bedst = { vare: v.id, havn: h.id, salg: s, koeb: her, gevinst: gevinst };
        });
      });
      return bedst;
    }
    // Køb et rygte om den nærmeste ukendte havn: den kommer på kortet med lidt hav omkring.
    function rygtePris() { return HAVNE.some(function (h) { return !st.kendt[h.id]; }) ? RYGTE_PRIS : null; }
    function rygteHavn() {
      if (!kanHandle()) return { ok: false };
      var ukendte = HAVNE.filter(function (h) { return !st.kendt[h.id]; });
      if (!ukendte.length) return { ok: false, grund: 'alle' };
      if (st.guld < RYGTE_PRIS) return { ok: false, grund: 'guld', mangler: RYGTE_PRIS - st.guld };
      var x = st.pos[0], y = st.pos[1];
      ukendte.sort(function (a, b) {
        var pa = st.havnePos[a.id], pb = st.havnePos[b.id];
        return (Math.pow(pa[0] - x, 2) + Math.pow(pa[1] - y, 2)) - (Math.pow(pb[0] - x, 2) + Math.pow(pb[1] - y, 2));
      });
      var h = ukendte[0].id, p = st.havnePos[h];
      st.guld -= RYGTE_PRIS; st.kendt[h] = true; afsloer(p[0], p[1], 1);
      return { ok: true, havn: h, pris: RYGTE_PRIS };
    }
    // Kikkert fra værftet: længere synsvidde
    function kikkertPris() { var k = st.kikkert || 0; return k >= KIKKERT_PRIS.length ? null : KIKKERT_PRIS[k]; }
    function koebKikkert() {
      if (!kanHandle()) return { ok: false };
      var p = kikkertPris();
      if (p === null) return { ok: false, grund: 'max' };
      if (st.guld < p) return { ok: false, grund: 'guld', mangler: p - st.guld };
      st.guld -= p; st.kikkert = (st.kikkert || 0) + 1; st.investeret += p;
      opdag();
      return { ok: true, pris: p, syn: synsvidde() };
    }

    // ---------- Til søs: ét felt er én dag ----------
    function kanSejle() { return !st.over && !(st.moede && !st.moede.slut); }
    function synligeIds() { return synligeSkibe().map(function (s) { return s.id; }); }
    function flyt(dx, dy, auto) {
      if (!kanSejle()) return { ok: false, grund: st.over ? 'over' : 'moede' };
      dx = clamp(Math.round(dx) || 0, -1, 1); dy = clamp(Math.round(dy) || 0, -1, 1);
      if (!dx && !dy) return { ok: false, grund: 'stille' };
      var nx = st.pos[0] + dx, ny = st.pos[1] + dy;
      if (erLand(nx, ny)) return { ok: false, grund: ude(nx, ny) ? 'kant' : 'land' };
      if (st.moede) efterMoede();
      if (!auto) st.kurs = null;
      var andet = skibPaa(nx, ny);
      if (andet && !st.havn) {
        var mm = startMoede(andet);
        return { ok: true, dag: st.dag, sult: null, nyeHavne: [], havn: null, moede: mm, nyeSkibe: [] };
      }
      var foer = synligeIds();
      st.havn = null;
      st.pos = [nx, ny];
      return efterDag(foer, true);
    }
    // Lig stille en dag (kun til søs): skibene omkring sejler videre.
    function vent() {
      if (!kanSejle() || st.havn) return { ok: false, grund: st.havn ? 'havn' : 'moede' };
      if (st.moede) efterMoede();
      st.kurs = null;
      return efterDag(synligeIds(), false);
    }
    function efterDag(foer, flyttede) {
      var r = { ok: true, sult: null, nyeHavne: [], havn: null, moede: null, nyeSkibe: [] };
      st.dag++; if (flyttede) st.tal.felter = (st.tal.felter || 0) + 1;
      r.sult = spis(1);
      r.dag = st.dag;
      if (st.over) return r;
      r.nyeHavne = opdag();
      var h = havnVed(st.pos[0], st.pos[1]);
      if (h) { anloeb(h); r.havn = h; }
      st.skibe = st.skibe.filter(skibTrin);
      nyeSkibe();
      if (!h) {
        var naer = null;
        st.skibe.forEach(function (s) { if (cheb(s.x, s.y, st.pos[0], st.pos[1]) <= 1 && !naer) naer = s; });
        if (naer) r.moede = startMoede(naer);
        else if (rng(st) < STORM_CHANCE) { st.moede = { slags: 'storm', slut: null }; st.kurs = null; r.moede = st.moede; }
      }
      r.nyeSkibe = synligeIds().filter(function (id) { return foer.indexOf(id) < 0; });
      return r;
    }
    function anloeb(h) {
      st.havn = h; st.sidste = h; st.kendt[h] = true; st.tal.rejser++;
      st.besoeg[h] = (st.besoeg[h] || 0) + 1;
      // Priserne ændrer sig over tid: havnen, man kommer til, får nye priser,
      // og de andre havne glider lidt.
      st.priser[h] = nyePriser(havnById(h));
      HAVNE.forEach(function (o) {
        if (o.id === h) return;
        VARER.forEach(function (v) {
          var base = FAKTOR[niveauI(o, v.id)], f = st.priser[o.id][v.id];
          f = f + (base - f) * 0.25 + base * rfloat(st, -0.06, 0.06);
          st.priser[o.id][v.id] = Math.round(clamp(f, base * 0.6, base * 1.4) * 1000) / 1000;
        });
      });
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

    // ---------- Andre skibe på havet ----------
    function erFjendeTilSoes(s) { return s.slags === 'pirat' || (s.slags === 'marine' && st.beroemmelse >= 10); }
    function optaget(x, y, selv) {
      if (erLand(x, y) || havnVed(x, y)) return true;
      if (x === st.pos[0] && y === st.pos[1]) return true;
      var s = skibPaa(x, y); return !!(s && s !== selv);
    }
    function skibTrin(s) {
      var d = cheb(s.x, s.y, st.pos[0], st.pos[1]);
      if (d > 14) return false;
      var maal, vaek = false, p;
      if (erFjendeTilSoes(s) && d <= 5 && !st.havn) {
        p = clamp(0.45 + 0.15 * (s.fart - fart()), 0.2, 0.9); maal = st.pos;
      } else if (s.slags === 'handel' && d <= 2 && !st.havn) {
        p = clamp(0.3 + 0.1 * (s.fart - fart()), 0.1, 0.8); maal = st.pos; vaek = true;
      } else {
        p = 0.5;
        if (!s.maal || (s.x === s.maal[0] && s.y === s.maal[1]) || rng(st) < 0.05) {
          s.maal = [clamp(s.x + rint(st, -8, 8), 0, BREDDE - 1), clamp(s.y + rint(st, -6, 6), 0, HOEJDE - 1)];
        }
        maal = s.maal;
      }
      if (rng(st) >= p) return true;
      var bedst = null, bedstV = null, nu = afst(s.x, s.y, maal);
      for (var r = 0; r < 8; r++) {
        var x = s.x + RETNINGER[r][0], y = s.y + RETNINGER[r][1];
        if (optaget(x, y, s)) continue;
        var v = afst(x, y, maal) * (vaek ? -1 : 1) + rng(st) * 0.01;
        if (bedstV === null || v < bedstV) { bedstV = v; bedst = [x, y]; }
      }
      if (bedst && (vaek ? -bedstV > nu - 0.001 : bedstV < nu + 0.5)) { s.x = bedst[0]; s.y = bedst[1]; }
      return true;
    }
    function afst(x, y, m) { return Math.sqrt(Math.pow(x - m[0], 2) + Math.pow(y - m[1], 2)); }
    function nyeSkibe() {
      var r = synsvidde();
      var naer = st.skibe.filter(function (s) { return cheb(s.x, s.y, st.pos[0], st.pos[1]) <= r + 6; }).length;
      if (naer >= 3 || rng(st) >= 0.25) return null;
      var a = rint(st, r + 2, r + 5);
      for (var t = 0; t < 30; t++) {
        var dx = rint(st, -a, a), dy = rint(st, -a, a);
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== a) continue;
        var x = st.pos[0] + dx, y = st.pos[1] + dy;
        if (optaget(x, y, null)) continue;
        var s = nytSoeSkib(x, y); st.skibe.push(s); return s;
      }
      return null;
    }
    function naerHavn(id, d) { var p = st.havnePos[id]; return p && cheb(p[0], p[1], st.pos[0], st.pos[1]) <= d; }
    function nytSoeSkib(x, y) {
      var skjul = naerHavn('ravnsoe', 7), flaade = naerHavn('kongshavn', 7);
      var w = { handel: 35, pirat: 28 + (skjul ? 22 : 0), marine: 6 + st.beroemmelse * 0.6 + (flaade ? 15 : 0) };
      var slags = vaegtet(st, w), lv = niveau();
      return {
        id: st.naesteId++, slags: slags, x: x, y: y, maal: null,
        fart: slags === 'marine' ? 5 : slags === 'pirat' ? 4 + (lv > 2 ? 1 : 0) : 3,
        skibstype: slags === 'marine' ? 'fregat' : slags === 'handel' ? (lv >= 3 ? 'brig' : 'slup') : (lv >= 2 ? 'brig' : 'slup')
      };
    }
    function startMoede(s) {
      var m = nytSkib(s.slags);
      st.tal.moeder = (st.tal.moeder || 0) + 1;
      m.skibId = s.id; m.afstand = 2; m.skibstype = s.skibstype; m.fart = s.fart;
      st.moede = m; st.kurs = null;
      return m;
    }
    // Når mødet er slut, forsvinder det andet skib fra havet.
    function efterMoede() {
      var m = st.moede;
      if (!m || !m.slut) return false;
      if (m.skibId) st.skibe = st.skibe.filter(function (s) { return s.id !== m.skibId; });
      st.moede = null;
      return true;
    }

    // ---------- Kurs mod en kendt havn (sejler selv over kendt hav) ----------
    function sti(til) {
      var m = st.havnePos[til];
      if (!m || !st.kendt[til]) return null;
      var s = st.pos;
      if (s[0] === m[0] && s[1] === m[1]) return [];
      var fra = {}, ko = [s], k0 = s[1] * BREDDE + s[0];
      fra[k0] = -1;
      while (ko.length) {
        var p = ko.shift();
        if (p[0] === m[0] && p[1] === m[1]) break;
        for (var r = 0; r < 8; r++) {
          var x = p[0] + RETNINGER[r][0], y = p[1] + RETNINGER[r][1], i = y * BREDDE + x;
          if (erLand(x, y) || fra[i] !== undefined || !sett(x, y)) continue;
          var hv = havnVed(x, y);
          if (hv && hv !== til) continue;
          fra[i] = p[1] * BREDDE + p[0]; ko.push([x, y]);
        }
      }
      var mi = m[1] * BREDDE + m[0];
      if (fra[mi] === undefined) return null;
      var vej = [];
      for (var c = mi; c !== k0; c = fra[c]) vej.unshift([c % BREDDE, Math.floor(c / BREDDE)]);
      return vej;
    }
    function kursInfo(til) {
      var v = sti(til);
      return v ? { dage: v.length, proviant: v.length, nok: st.proviant >= v.length, havn: havnById(til), sti: v } : null;
    }
    function saetKurs(til) {
      if (!kanSejle()) return { ok: false, grund: 'moede' };
      if (!st.kendt[til]) return { ok: false, grund: 'ukendt' };
      if (til === st.havn) return { ok: false, grund: 'her' };
      var v = sti(til);
      if (!v) return { ok: false, grund: 'ingen-vej' };
      if (st.moede) efterMoede();
      st.kurs = { til: til };
      return { ok: true, dage: v.length };
    }
    function stopKurs() { st.kurs = null; }
    // Ét skridt (én dag) ad kursen. r.stop siger, hvorfor sejladsen holder op.
    function autoTrin() {
      if (!st.kurs) return null;
      var til = st.kurs.til, v = sti(til);
      if (!v || !v.length) { st.kurs = null; return { ok: false, stop: 'ingen-vej' }; }
      var p0 = st.proviant;
      var r = flyt(v[0][0] - st.pos[0], v[0][1] - st.pos[1], true);
      if (!r.ok) { st.kurs = null; r.stop = 'blokeret'; return r; }
      if (st.over) r.stop = 'over';
      else if (r.moede) r.stop = 'moede';
      else if (r.havn) r.stop = r.havn === til ? 'fremme' : 'havn';
      else if (r.nyeSkibe.length) r.stop = 'skib';
      else if (p0 > 0 && st.proviant === 0) r.stop = 'proviant';
      if (r.stop) st.kurs = null;
      return r;
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
    function point() { return formue() + BEROEMMELSE_FAKTOR * st.beroemmelse; }
    function slut(grund) {
      if (st.over) return st.over;
      st.over = { grund: grund };
      st.over.formue = formue(); st.over.point = point();
      st.over.dage = st.dag; st.over.skib = st.skib; st.over.beroemmelse = st.beroemmelse;
      return st.over;
    }
    function gaaILand() {
      if (st.over) return st.over;
      if (!st.havn || (st.moede && !st.moede.slut)) return null;
      return slut('land');
    }

    return {
      get state() { return st; },
      VARER: VARER, HAVNE: HAVNE, SKIBE: SKIBE,
      type: type, lastrum: lastrum, lastIalt: lastIalt, fri: fri, fart: fart, maxSkrog: maxSkrog,
      maxMandskab: maxMandskab, effKanoner: effKanoner, niveau: niveau, kanHandle: kanHandle,
      pris: pris, koeb: koeb, saelg: saelg, gnsKoebt: gnsKoebt,
      reparationPris: reparationPris, reparer: reparer, kanonPris: kanonPris, koebKanon: koebKanon,
      opgraderPris: opgraderPris, opgrader: opgrader, naesteSkib: naesteSkib, koebSkib: koebSkib, skibsvaerdi: skibsvaerdi,
      kikkertPris: kikkertPris, koebKikkert: koebKikkert,
      hyrePris: hyrePris, hyr: hyr, proviantPris: proviantPris, proviant: proviant, rygte: rygte,
      rygtePris: rygtePris, rygteHavn: rygteHavn,
      felt: felt, sett: sett, iSyn: iSyn, synsvidde: synsvidde, havnVed: havnVed, havnePos: havnePos,
      kendteHavne: kendteHavne, andelOpdaget: andelOpdaget, synligeSkibe: synligeSkibe, kanSejle: kanSejle,
      flyt: flyt, vent: vent, sti: sti, kursInfo: kursInfo, saetKurs: saetKurs, stopKurs: stopKurs, autoTrin: autoTrin,
      efterMoede: efterMoede,
      handling: handling, storm: storm, erFjendtlig: erFjendtlig,
      traefChance: traefChance, flugtChance: flugtChance, naermereChance: naermereChance, bordChance: bordChance,
      lastVaerdi: lastVaerdi, formue: formue, point: point, gaaILand: gaaILand, slut: slut,
      save: function () { return JSON.parse(JSON.stringify(st)); },
      _rng: function () { return rng(st); },
      _nytSkib: function (slags, x, y) { var s = nytSoeSkib(x, y); s.slags = slags; st.skibe.push(s); return s; }
    };
  }

  global.KaperenLogik = {
    createGame: createGame, VARER: VARER, HAVNE: HAVNE, SKIBE: SKIBE, havnById: havnById, vareById: vareById,
    skibById: skibById, AFSTANDE: AFSTANDE, PROVIANT_MAX: PROVIANT_MAX, KANON_PRIS: KANON_PRIS,
    REPARATION: REPARATION, TRAEF: TRAEF, START: START, BREDDE: BREDDE, HOEJDE: HOEJDE, SYN: SYN,
    KIKKERT_PRIS: KIKKERT_PRIS, RYGTE_PRIS: RYGTE_PRIS, BEROEMMELSE_FAKTOR: BEROEMMELSE_FAKTOR, RETNINGER: RETNINGER
  };
})(typeof window !== 'undefined' ? window : globalThis);
