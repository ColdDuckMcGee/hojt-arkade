/*
 * Kælderen – spillogik (ren JavaScript, ingen DOM, ingen farver, ingen grafik).
 *
 * Et turbaseret "kælderskytte"-spil på et gitter. Hvert træk (skridt, sidetrin,
 * drej, handling eller vent) er én tur, og først derefter handler fjenderne.
 * Intet sker uden et træk.
 *
 * Hver etage laves automatisk (rum og gange). Find nøglekortet, åbn den låste
 * dør, og gå ned ad trappen. Mellem etagerne ligger en butik, hvor skat kan
 * bruges på opgraderinger.
 *
 *   var run = KaelderLogik.createRun({ seed: 42 });
 *   run.act('frem');            // frem, tilbage, venstre, hoejre (sidetrin), drejV, drejH, handling, vent
 *   run.kontekst();             // hvad Handling gør lige nu
 *   run.state                   // hele tilstanden (kan gemmes som JSON)
 *
 * Retninger: 0 = nord (op på kortet), 1 = øst, 2 = syd, 3 = vest.
 * Felter: 0 væg, 1 gulv, 2 lukket dør, 3 åben dør, 4 låst dør.
 */
(function (root) {
  'use strict';

  var VAEG = 0, GULV = 1, DOER = 2, AABEN = 3, LAAST = 4;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var RETNING = ['nord', 'øst', 'syd', 'vest'];

  var FJENDER = {
    kravler: { navn: 'Kravler', hp: 2, skade: 2, raekke: 1, fart: 1, skat: 6, fra: 1 },
    skytte:  { navn: 'Skytte',  hp: 2, skade: 1, raekke: 6, fart: 1, skat: 10, fra: 2 },
    kolos:   { navn: 'Kolos',   hp: 6, skade: 3, raekke: 1, fart: 2, skat: 20, fra: 3 }
  };
  var TING = {
    ammo:   { navn: 'ammunition' },
    liv:    { navn: 'førstehjælp' },
    skat:   { navn: 'skat' },
    noegle: { navn: 'nøglekortet' }
  };
  var RULES = {
    startHp: 10, startAmmo: 8, startMaxAmmo: 12, skudRaekke: 8,
    ammoPakke: 4, livPakke: 4, sigtBase: 5, maxLygte: 4, maxRustning: 3, maxVaaben: 5,
    pointPrEtage: 1000
  };
  var BUTIK = [
    { id: 'liv',      navn: 'Mere liv',         tekst: '+3 maks. liv',           pris: 60 },
    { id: 'heal',     navn: 'Førstehjælp',      tekst: 'Fuldt liv',              pris: 30 },
    { id: 'vaaben',   navn: 'Bedre våben',      tekst: '+1 skade, sikrere skud', pris: 80 },
    { id: 'magasin',  navn: 'Større magasin',   tekst: '+4 ammo-plads',          pris: 50 },
    { id: 'ammo',     navn: 'Ammunition',       tekst: '+6 skud',                pris: 20 },
    { id: 'rustning', navn: 'Rustning',         tekst: '−1 skade pr. træf',      pris: 90 },
    { id: 'lygte',    navn: 'Bedre lommelygte', tekst: '+1 synsvidde',           pris: 50 }
  ];

  // ---------- Tilfældighed (seedet, så alt kan gentages i test) ----------
  function rnd(s) {
    var t = (s.rngS = (s.rngS + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rint(s, a, b) { return a + Math.floor(rnd(s) * (b - a + 1)); }
  function pickR(s, arr) { return arr[Math.floor(rnd(s) * arr.length)]; }

  // ---------- Hjælpere ----------
  function idx(s, x, y) { return y * s.W + x; }
  function inside(s, x, y) { return x >= 0 && y >= 0 && x < s.W && y < s.H; }
  function cell(s, x, y) { return inside(s, x, y) ? s.cells[idx(s, x, y)] : VAEG; }
  function gaaelig(c) { return c === GULV || c === AABEN; }
  function gennemsigtig(c) { return c === GULV || c === AABEN; }
  function fjendeVed(s, x, y) {
    for (var i = 0; i < s.fjender.length; i++) { var f = s.fjender[i]; if (f.hp > 0 && f.x === x && f.y === y) return f; }
    return null;
  }
  function tingVed(s, x, y) {
    for (var i = 0; i < s.ting.length; i++) { var t = s.ting[i]; if (t.x === x && t.y === y) return t; }
    return null;
  }
  function erTrappe(s, x, y) { return !!s.trappe && s.trappe.x === x && s.trappe.y === y; }
  function manh(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

  // Fri sigtelinje mellem to feltcentre (kun gulv og åbne døre er gennemsigtige)
  function sigtelinje(s, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 3);
    for (var i = 1; i < n; i++) {
      var x = Math.round(x0 + dx * i / n), y = Math.round(y0 + dy * i / n);
      if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1) && !gennemsigtig(cell(s, x, y))) return false;
    }
    return true;
  }
  // Lige linje (samme række eller kolonne) uden vægge, lukkede døre eller andre fjender imellem
  function ligeLinje(s, x0, y0, x1, y1, ignorer) {
    if (x0 !== x1 && y0 !== y1) return false;
    var sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0), x = x0 + sx, y = y0 + sy;
    while (x !== x1 || y !== y1) {
      if (!gennemsigtig(cell(s, x, y))) return false;
      var f = fjendeVed(s, x, y); if (f && f !== ignorer) return false;
      x += sx; y += sy;
    }
    return true;
  }

  // ---------- Etagegenerering ----------
  function nyEtage(s) {
    for (var forsoeg = 0; forsoeg < 60; forsoeg++) {
      if (bygEtage(s) && validerEtage(s).ok) return true;
    }
    throw new Error('Kunne ikke lave en etage');
  }

  function bygEtage(s) {
    var e = s.etage;
    var W = 23 + Math.min(10, e), H = 23 + Math.min(10, e);
    s.W = W; s.H = H;
    var N = W * H;
    s.cells = new Array(N).fill(VAEG);
    s.rum = new Array(N).fill(-1);
    s.udforsket = new Array(N).fill(0);
    s.synlig = new Array(N).fill(0);
    s.fjender = []; s.ting = []; s.lamper = []; s.trappe = null; s.laast = null;
    s.rooms = [];
    // Rum (mindst én vægs afstand + plads til gange)
    var maal = Math.min(11, 6 + Math.floor(e / 2));
    for (var t = 0; t < 400 && s.rooms.length < maal; t++) {
      var w = rint(s, 3, 6), h = rint(s, 3, 6);
      var x = rint(s, 2, W - w - 3), y = rint(s, 2, H - h - 3);
      var ok = s.rooms.every(function (r) { return x + w + 2 <= r.x || r.x + r.w + 2 <= x || y + h + 2 <= r.y || r.y + r.h + 2 <= y; });
      if (ok) s.rooms.push({ x: x, y: y, w: w, h: h });
    }
    if (s.rooms.length < 5) return false;
    // Start: det første rum. Boksen (med trappen): det rum, der ligger længst væk.
    var r0 = s.rooms[0], vi = 1, best = -1;
    s.rooms.forEach(function (r, i) {
      if (i === 0) return;
      var d = manh(cx(r0), cy(r0), cx(r), cy(r));
      if (d > best) { best = d; vi = i; }
    });
    var vault = s.rooms[vi];
    // Boksens zone: rummet og ringen rundt om det. Ingen gang må gå igennem den.
    function iZone(x, y) { return x >= vault.x - 1 && x <= vault.x + vault.w && y >= vault.y - 1 && y <= vault.y + vault.h; }
    s.rooms.forEach(function (r, i) { if (i !== vi) carveRoom(s, r, i); });
    // Forbind de andre rum (hvert nyt rum til det nærmeste, der allerede er forbundet)
    var forbundet = [0];
    var andre = [];
    s.rooms.forEach(function (r, i) { if (i !== 0 && i !== vi) andre.push(i); });
    while (andre.length) {
      var bi = 0, bj = 0, bd = 1e9;
      andre.forEach(function (i, k) {
        forbundet.forEach(function (j) {
          var d = manh(cx(s.rooms[i]), cy(s.rooms[i]), cx(s.rooms[j]), cy(s.rooms[j]));
          if (d < bd) { bd = d; bi = k; bj = j; }
        });
      });
      var ri = andre.splice(bi, 1)[0];
      if (!gang(s, s.rooms[ri], s.rooms[bj], iZone)) return false;
      forbundet.push(ri);
      // En ekstra gang i ny og næ giver rundgange
      if (rnd(s) < 0.25 && forbundet.length > 2) {
        var rj = pickR(s, forbundet);
        if (rj !== ri) gang(s, s.rooms[ri], s.rooms[rj], iZone);
      }
    }
    // Boksen: rummet hugges ud, og én gang fører ud fra én side, med den låste dør
    carveRoom(s, vault, vi);
    var mal = null, md = 1e9;
    s.rooms.forEach(function (r, i) {
      if (i === vi) return;
      var d = manh(cx(r), cy(r), cx(vault), cy(vault)); if (d < md) { md = d; mal = r; }
    });
    var dxv = cx(mal) - cx(vault), dyv = cy(mal) - cy(vault), side;
    if (Math.abs(dxv) > Math.abs(dyv)) side = dxv > 0 ? 1 : 3; else side = dyv > 0 ? 2 : 0;
    var dx0, dy0;
    if (side === 1) { dx0 = vault.x + vault.w; dy0 = cy(vault); }
    else if (side === 3) { dx0 = vault.x - 1; dy0 = cy(vault); }
    else if (side === 2) { dx0 = cx(vault); dy0 = vault.y + vault.h; }
    else { dx0 = cx(vault); dy0 = vault.y - 1; }
    // Bredde-først søgning fra døren til nærmeste gulv uden for zonen
    var sti = bfsHug(s, dx0, dy0, side, iZone);
    if (!sti) return false;
    sti.forEach(function (p) { s.cells[idx(s, p.x, p.y)] = GULV; });
    s.cells[idx(s, dx0, dy0)] = LAAST;
    s.laast = { x: dx0, y: dy0 };
    // Almindelige døre, hvor en gang går ind i et rum
    laegDoere(s, iZone);
    // Trappen midt i boksen
    s.trappe = { x: cx(vault), y: cy(vault) };
    s.vault = vi;
    // Spilleren midt i startrummet, med blikket mod den åbne side
    var p = s.spiller;
    p.x = cx(r0); p.y = cy(r0);
    var bd2 = -1;
    for (var d = 0; d < 4; d++) {
      var n = 0, xx = p.x + DX[d], yy = p.y + DY[d];
      while (gaaelig(cell(s, xx, yy)) && n < 20) { n++; xx += DX[d]; yy += DY[d]; }
      if (n > bd2) { bd2 = n; p.dir = d; }
    }
    p.noegle = false;
    // Optaget-sæt: start, trappe
    var optaget = {};
    function opt(x, y) { optaget[x + ',' + y] = 1; }
    function fri(x, y) { return !optaget[x + ',' + y] && cell(s, x, y) === GULV; }
    opt(p.x, p.y); opt(s.trappe.x, s.trappe.y);
    function felt(r, kant) {
      for (var k = 0; k < 40; k++) {
        var x = rint(s, r.x, r.x + r.w - 1), y = rint(s, r.y, r.y + r.h - 1);
        if (kant && x !== r.x && x !== r.x + r.w - 1 && y !== r.y && y !== r.y + r.h - 1 && k < 30) continue;
        if (fri(x, y)) { opt(x, y); return { x: x, y: y }; }
      }
      return null;
    }
    // Nøglen: i et rum langt fra start (ikke boksen)
    var kand = [];
    s.rooms.forEach(function (r, i) { if (i !== 0 && i !== vi) kand.push(i); });
    kand.sort(function (a, b) { return manh(cx(s.rooms[b]), cy(s.rooms[b]), p.x, p.y) - manh(cx(s.rooms[a]), cy(s.rooms[a]), p.x, p.y); });
    var noegleRum = kand[Math.min(kand.length - 1, rint(s, 0, 1))];
    var nf = felt(s.rooms[noegleRum]);
    if (!nf) return false;
    s.ting.push({ id: s.nextId++, type: 'noegle', x: nf.x, y: nf.y, vaerdi: 1 });
    // Lamper: én i hvert rum (pynt; tegnelaget bruger dem som lyskilder)
    s.rooms.forEach(function (r) { s.lamper.push({ x: cx(r), y: cy(r) }); });
    // Ting
    var rumUdenStart = s.rooms.filter(function (r, i) { return i !== 0; });
    var nAmmo = 3 + (e > 3 ? 1 : 0), nLiv = 2, nSkat = 4 + Math.min(4, Math.floor(e / 2));
    function laegTing(type, n, vaerdi) {
      for (var i = 0; i < n; i++) {
        var f = felt(pickR(s, rumUdenStart), true);
        if (f) s.ting.push({ id: s.nextId++, type: type, x: f.x, y: f.y, vaerdi: typeof vaerdi === 'function' ? vaerdi() : vaerdi });
      }
    }
    laegTing('ammo', nAmmo, RULES.ammoPakke);
    laegTing('liv', nLiv, RULES.livPakke);
    laegTing('skat', nSkat, function () { return 10 * rint(s, 1, 3) + 5 * Math.min(6, e - 1); });
    // Fjender: ikke i startrummet, og aldrig tæt på start
    var typer = Object.keys(FJENDER).filter(function (k) { return FJENDER[k].fra <= e; });
    var nF = Math.min(16, 2 + e + Math.floor(e / 2));
    var fjendeRum = s.rooms.filter(function (r, i) { return i !== 0; });
    for (var i = 0; i < nF; i++) {
      var type;
      if (i === 0 && e >= 2 && e <= 3) type = e === 2 ? 'skytte' : 'kolos'; // den nye type ses med det samme
      else type = pickR(s, typer);
      var ff = null;
      for (var k = 0; k < 10 && !ff; k++) {
        var cand = felt(pickR(s, fjendeRum));
        if (cand && manh(cand.x, cand.y, p.x, p.y) >= 6) ff = cand;
      }
      if (!ff) continue;
      var def = FJENDER[type];
      var hp = def.hp + Math.floor((e - 1) / 3) * (type === 'kolos' ? 2 : 1);
      s.fjender.push({ id: s.nextId++, type: type, x: ff.x, y: ff.y, px: ff.x, py: ff.y, hp: hp, max: hp, vaagen: false, sidst: 0 });
    }
    afsloer(s);
    return true;
  }
  function cx(r) { return r.x + (r.w >> 1); }
  function cy(r) { return r.y + (r.h >> 1); }
  function carveRoom(s, r, i) {
    for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) { s.cells[idx(s, x, y)] = GULV; s.rum[idx(s, x, y)] = i; }
  }
  // En L-formet gang mellem to rum. Rammer den boksens zone, prøves den anden L og så en omvej.
  function gang(s, a, b, iZone) {
    var x0 = cx(a), y0 = cy(a), x1 = cx(b), y1 = cy(b);
    var varianter = rnd(s) < 0.5 ? [0, 1] : [1, 0];
    for (var v = 0; v < 2; v++) {
      var pts = lSti(x0, y0, x1, y1, varianter[v]);
      if (pts.every(function (p) { return !iZone(p.x, p.y) && p.x > 0 && p.y > 0 && p.x < s.W - 1 && p.y < s.H - 1; })) {
        pts.forEach(function (p) { s.cells[idx(s, p.x, p.y)] = GULV; });
        return true;
      }
    }
    // Omvej: korteste vej uden om zonen
    var prev = {}, q = [[x0, y0]], key = function (x, y) { return y * s.W + x; };
    prev[key(x0, y0)] = -1;
    while (q.length) {
      var c = q.shift();
      if (c[0] === x1 && c[1] === y1) break;
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DX[d], ny = c[1] + DY[d];
        if (nx < 1 || ny < 1 || nx > s.W - 2 || ny > s.H - 2 || iZone(nx, ny)) continue;
        var k = key(nx, ny); if (prev[k] !== undefined) continue;
        prev[k] = key(c[0], c[1]); q.push([nx, ny]);
      }
    }
    var kk = key(x1, y1); if (prev[kk] === undefined) return false;
    while (kk !== -1) { s.cells[kk] = GULV; kk = prev[kk]; }
    return true;
  }
  function lSti(x0, y0, x1, y1, hf) {
    var pts = [], x = x0, y = y0;
    pts.push({ x: x, y: y });
    if (hf) { while (x !== x1) { x += Math.sign(x1 - x); pts.push({ x: x, y: y }); } while (y !== y1) { y += Math.sign(y1 - y); pts.push({ x: x, y: y }); } }
    else { while (y !== y1) { y += Math.sign(y1 - y); pts.push({ x: x, y: y }); } while (x !== x1) { x += Math.sign(x1 - x); pts.push({ x: x, y: y }); } }
    return pts;
  }
  // Fra boksens dør: ét felt lige ud, og derfra korteste vej til nærmeste gulv uden for zonen
  function bfsHug(s, x0, y0, side, iZone) {
    var ux = x0 + DX[side], uy = y0 + DY[side];
    if (ux < 1 || uy < 1 || ux > s.W - 2 || uy > s.H - 2) return null;
    var start = [{ x: x0, y: y0 }, { x: ux, y: uy }];
    if (s.cells[idx(s, ux, uy)] === GULV) return start;
    var prev = {}, q = [[ux, uy]], key = function (x, y) { return y * s.W + x; };
    prev[key(ux, uy)] = -1;
    var slut = -1;
    while (q.length) {
      var c = q.shift();
      if (s.cells[key(c[0], c[1])] === GULV) { slut = key(c[0], c[1]); break; }
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DX[d], ny = c[1] + DY[d];
        if (nx < 1 || ny < 1 || nx > s.W - 2 || ny > s.H - 2 || iZone(nx, ny)) continue;
        var k = key(nx, ny); if (prev[k] !== undefined) continue;
        prev[k] = key(c[0], c[1]); q.push([nx, ny]);
      }
    }
    if (slut < 0) return null;
    var out = [{ x: x0, y: y0 }];
    for (var k2 = slut; k2 !== -1; k2 = prev[k2]) out.push({ x: k2 % s.W, y: Math.floor(k2 / s.W) });
    return out;
  }
  // Døre: et gangfelt med væg på begge sider, der fører ind i et rum
  function laegDoere(s, iZone) {
    for (var y = 1; y < s.H - 1; y++) for (var x = 1; x < s.W - 1; x++) {
      var i = idx(s, x, y);
      if (s.cells[i] !== GULV || s.rum[i] >= 0 || iZone(x, y)) continue;
      var n = cell(s, x, y - 1), so = cell(s, x, y + 1), o = cell(s, x + 1, y), v = cell(s, x - 1, y);
      var vandret = n === VAEG && so === VAEG && gaaelig(o) && gaaelig(v);
      var lodret = o === VAEG && v === VAEG && gaaelig(n) && gaaelig(so);
      if (!vandret && !lodret) continue;
      var rumNabo = vandret ? (s.rum[idx(s, x + 1, y)] >= 0) !== (s.rum[idx(s, x - 1, y)] >= 0)
                            : (s.rum[idx(s, x, y + 1)] >= 0) !== (s.rum[idx(s, x, y - 1)] >= 0);
      if (!rumNabo) continue;
      var naboDoer = [0, 1, 2, 3].some(function (d) { var c = cell(s, x + DX[d], y + DY[d]); return c === DOER || c === LAAST; });
      if (naboDoer || rnd(s) > 0.45) continue;
      s.cells[i] = DOER;
    }
  }

  // Kontrol: nøglen kan nås uden den låste dør, trappen kun gennem den låste dør
  function naaelige(s, laastAaben) {
    var seen = new Array(s.W * s.H).fill(0), q = [idx(s, s.spiller.x, s.spiller.y)];
    seen[q[0]] = 1;
    while (q.length) {
      var c = q.shift(), x = c % s.W, y = Math.floor(c / s.W);
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d]; if (!inside(s, nx, ny)) continue;
        var k = idx(s, nx, ny), t = s.cells[k];
        if (seen[k]) continue;
        if (t === VAEG || (t === LAAST && !laastAaben)) continue;
        seen[k] = 1; q.push(k);
      }
    }
    return seen;
  }
  function validerEtage(s) {
    var uden = naaelige(s, false), med = naaelige(s, true);
    var n = s.ting.filter(function (t) { return t.type === 'noegle'; })[0];
    var res = {
      noegleNaaelig: !!n && !!uden[idx(s, n.x, n.y)],
      trappeLukket: !!s.trappe && !uden[idx(s, s.trappe.x, s.trappe.y)],
      trappeNaaelig: !!s.trappe && !!med[idx(s, s.trappe.x, s.trappe.y)],
      tingNaaelige: s.ting.every(function (t) { return t.type === 'noegle' || med[idx(s, t.x, t.y)]; })
    };
    res.ok = res.noegleNaaelig && res.trappeLukket && res.trappeNaaelig && res.tingNaaelige;
    return res;
  }

  // ---------- Synsvidde og kortet ----------
  function sigt(s) { return RULES.sigtBase + s.spiller.lygte; }
  function afsloer(s) {
    var p = s.spiller, R = sigt(s);
    for (var i = 0; i < s.synlig.length; i++) s.synlig[i] = 0;
    for (var y = Math.max(0, p.y - R); y <= Math.min(s.H - 1, p.y + R); y++) {
      for (var x = Math.max(0, p.x - R); x <= Math.min(s.W - 1, p.x + R); x++) {
        var dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy > R * R + 1) continue;
        if (!sigtelinje(s, p.x, p.y, x, y)) continue;
        var k = idx(s, x, y);
        s.synlig[k] = 1; s.udforsket[k] = 1;
      }
    }
  }

  // ---------- Tilstand ----------
  function newState(seed) {
    var s = {
      seed: seed >>> 0, rngS: seed | 0, etage: 1, tur: 0, fase: 'spil', nextId: 1,
      spiller: { x: 1, y: 1, dir: 1, hp: RULES.startHp, maxHp: RULES.startHp, ammo: RULES.startAmmo, maxAmmo: RULES.startMaxAmmo,
                 vaaben: 1, rustning: 0, lygte: 1, noegle: false },
      skat: 0, skatIalt: 0, drab: 0, koebt: {}, dybde: 1,
      sidsteSkade: null, sidsteSkud: null, haendelser: [], besked: '', doedAf: ''
    };
    nyEtage(s);
    s.besked = 'Etage 1. Find nøglekortet, og åbn den låste dør til trappen.';
    return s;
  }

  // Hvad står lige foran spilleren?
  function foran(s) {
    var p = s.spiller, x = p.x + DX[p.dir], y = p.y + DY[p.dir];
    var c = cell(s, x, y), f = fjendeVed(s, x, y), t = tingVed(s, x, y);
    if (f) return { type: 'fjende', fjende: f, x: x, y: y };
    if (c === DOER) return { type: 'doer', x: x, y: y };
    if (c === LAAST) return { type: 'laast', x: x, y: y };
    if (c === VAEG) return { type: 'vaeg', x: x, y: y };
    if (erTrappe(s, x, y)) return { type: 'trappe', x: x, y: y };
    if (t) return { type: 'ting', ting: t, x: x, y: y };
    return { type: 'gulv', x: x, y: y };
  }
  // Første fjende i synsretningen (inden for skudvidden)
  function maalForan(s) {
    var p = s.spiller, x = p.x, y = p.y;
    for (var d = 1; d <= RULES.skudRaekke; d++) {
      x += DX[p.dir]; y += DY[p.dir];
      if (!gennemsigtig(cell(s, x, y))) return null;
      var f = fjendeVed(s, x, y);
      if (f) return { fjende: f, afstand: d };
    }
    return null;
  }
  function traefChance(s, d) {
    var v = s.spiller.vaaben;
    return Math.max(0.25, Math.min(0.97, 0.95 - 0.11 * (d - 1) + 0.05 * (v - 1)));
  }
  // Det, Handling gør lige nu
  function kontekst(s) {
    if (s.fase !== 'spil') return { type: 'ingen', label: '' };
    var p = s.spiller, m = maalForan(s), fr = foran(s);
    if (m) {
      var navn = FJENDER[m.fjende.type].navn;
      if (p.ammo > 0) return { type: 'skyd', label: 'Skyd', chance: traefChance(s, m.afstand), fjende: m.fjende, afstand: m.afstand, navn: navn };
      if (m.afstand === 1) return { type: 'slaa', label: 'Slå', fjende: m.fjende, afstand: 1, navn: navn };
      return { type: 'ingenAmmo', label: 'Ingen ammo', fjende: m.fjende, afstand: m.afstand, navn: navn, kan: false };
    }
    if (erTrappe(s, p.x, p.y)) return { type: 'ned', label: 'Gå ned ad trappen' };
    if (fr.type === 'doer') return { type: 'aabn', label: 'Åbn dør', x: fr.x, y: fr.y };
    if (fr.type === 'laast') return p.noegle ? { type: 'aabnLaast', label: 'Lås op', x: fr.x, y: fr.y } : { type: 'laast', label: 'Låst', kan: false, x: fr.x, y: fr.y };
    if (fr.type === 'trappe') return { type: 'tilTrappe', label: 'Gå ned ad trappen', x: fr.x, y: fr.y };
    if (fr.type === 'ting') return { type: 'saml', label: 'Saml op', ting: fr.ting };
    return { type: 'vent', label: 'Vent' };
  }

  // Hvilke fjender kan ramme spilleren i deres næste tur?
  function trusler(s) {
    var p = s.spiller;
    return s.fjender.filter(function (f) {
      if (f.hp <= 0) return false;
      var d = manh(f.x, f.y, p.x, p.y);
      if (d === 1) return true;
      if (f.type === 'skytte' && f.vaagen !== false && d <= FJENDER.skytte.raekke && ligeLinje(s, f.x, f.y, p.x, p.y, f)) return true;
      return false;
    });
  }

  function ev(s, type, data) { var e = data || {}; e.type = type; s.haendelser.push(e); return e; }

  // Spiller går ind på et felt: saml ting op
  function paaFelt(s) {
    var p = s.spiller, t = tingVed(s, p.x, p.y);
    if (!t) return;
    s.ting.splice(s.ting.indexOf(t), 1);
    if (t.type === 'ammo') {
      var f = Math.min(p.maxAmmo, p.ammo + t.vaerdi) - p.ammo; p.ammo += f;
      s.besked = f > 0 ? 'Du samlede ' + f + ' skud op.' : 'Magasinet er fuldt. Ammunitionen blev liggende i lommen som skat (+5).';
      if (f <= 0) { s.skat += 5; s.skatIalt += 5; }
    } else if (t.type === 'liv') {
      var h = Math.min(p.maxHp, p.hp + t.vaerdi) - p.hp; p.hp += h;
      s.besked = h > 0 ? 'Førstehjælp: +' + h + ' liv.' : 'Du har fuldt liv. Førstehjælpen blev byttet til skat (+5).';
      if (h <= 0) { s.skat += 5; s.skatIalt += 5; }
    } else if (t.type === 'skat') {
      s.skat += t.vaerdi; s.skatIalt += t.vaerdi; s.besked = 'Skat: +' + t.vaerdi + '.';
    } else if (t.type === 'noegle') {
      p.noegle = true; s.besked = 'Du fandt nøglekortet! Find den låste dør.';
    }
    ev(s, 'ting', { ting: t.type, vaerdi: t.vaerdi });
  }

  function flyt(s, d) {
    var p = s.spiller, x = p.x + DX[d], y = p.y + DY[d], c = cell(s, x, y);
    if (fjendeVed(s, x, y)) { s.besked = 'En fjende står i vejen.'; ev(s, 'bump'); return false; }
    if (!gaaelig(c)) {
      s.besked = c === DOER ? 'Døren er lukket. Tryk på Handling for at åbne den.' : c === LAAST ? (p.noegle ? 'Døren er låst. Brug Handling for at låse op.' : 'Døren er låst. Du skal bruge nøglekortet.') : 'Der er en væg.';
      ev(s, 'bump'); return false;
    }
    p.x = x; p.y = y; ev(s, 'skridt');
    s.besked = '';
    paaFelt(s);
    if (erTrappe(s, x, y)) s.besked = 'Du står ved trappen. Tryk på Handling for at gå ned.';
    return true;
  }

  function skadSpiller(s, n, kilde) {
    var p = s.spiller, sk = Math.max(1, n - p.rustning);
    p.hp = Math.max(0, p.hp - sk);
    s.sidsteSkade = { tur: s.tur, n: sk, kilde: kilde.id, fra: { x: kilde.x, y: kilde.y } };
    ev(s, 'skade', { n: sk, fjende: kilde.type });
    if (p.hp <= 0) { s.fase = 'slut'; s.doedAf = FJENDER[kilde.type].navn; ev(s, 'doed'); }
    return sk;
  }
  function skadFjende(s, f, n) {
    f.hp = Math.max(0, f.hp - n); f.vaagen = true;
    if (f.hp <= 0) {
      s.drab++;
      var v = FJENDER[f.type].skat + 2 * (s.etage - 1);
      s.fjender.splice(s.fjender.indexOf(f), 1);
      // Fjenden efterlader skat, hvis feltet er frit
      if (!tingVed(s, f.x, f.y) && !erTrappe(s, f.x, f.y)) s.ting.push({ id: s.nextId++, type: 'skat', x: f.x, y: f.y, vaerdi: v });
      ev(s, 'drab', { fjende: f.type, x: f.x, y: f.y });
      return true;
    }
    return false;
  }

  // Fjendernes tur
  function fjendeTur(s) {
    var p = s.spiller;
    // Afstand til spilleren gennem gangbare felter (lukkede døre stopper)
    var N = s.W * s.H, dist = new Array(N).fill(-1), q = [idx(s, p.x, p.y)];
    dist[q[0]] = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], x = c % s.W, y = Math.floor(c / s.W);
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d]; if (!inside(s, nx, ny)) continue;
        var k = idx(s, nx, ny); if (dist[k] >= 0 || !gaaelig(s.cells[k])) continue;
        dist[k] = dist[c] + 1; q.push(k);
      }
    }
    s.fjender.slice().forEach(function (f) {
      if (s.fase !== 'spil' || f.hp <= 0) return;
      f.px = f.x; f.py = f.y;
      var def = FJENDER[f.type], md = manh(f.x, f.y, p.x, p.y), dd = dist[idx(s, f.x, f.y)];
      if (!f.vaagen) {
        if ((s.synlig[idx(s, f.x, f.y)] && md <= 8) || (dd >= 0 && dd <= 3)) { f.vaagen = true; ev(s, 'opdaget', { fjende: f.type }); }
        return; // vågner, men handler først næste tur
      }
      var skade = def.skade + Math.floor((s.etage - 1) / 4);
      if (md === 1) {
        var n = skadSpiller(s, f.type === 'skytte' ? Math.max(1, skade) : skade, f);
        ev(s, 'fjendeSlag', { fjende: f.type, n: n });
        s.besked = def.navn + ' rammer dig: −' + n + ' liv.';
        f.sidst = s.tur;
        return;
      }
      if (f.type === 'skytte' && md <= def.raekke && ligeLinje(s, f.x, f.y, p.x, p.y, f)) {
        var ch = Math.max(0.35, 0.8 - 0.07 * (md - 1));
        if (rnd(s) < ch) {
          var n2 = skadSpiller(s, skade, f);
          ev(s, 'fjendeSkud', { fjende: f.type, traf: true, n: n2 });
          s.besked = 'Skytten rammer dig: −' + n2 + ' liv.';
        } else {
          ev(s, 'fjendeSkud', { fjende: f.type, traf: false });
          s.besked = 'Skytten skyder forbi.';
        }
        f.sidst = s.tur;
        return;
      }
      if (def.fart > 1 && (s.tur % def.fart) !== 0) return; // tung: går kun hver anden tur
      if (dd < 0) return; // kan ikke komme hen til spilleren
      var bedst = null, bv = dd;
      for (var d2 = 0; d2 < 4; d2++) {
        var nx2 = f.x + DX[d2], ny2 = f.y + DY[d2]; if (!inside(s, nx2, ny2)) continue;
        var v = dist[idx(s, nx2, ny2)];
        if (v < 0 || v >= bv || (nx2 === p.x && ny2 === p.y) || fjendeVed(s, nx2, ny2)) continue;
        bv = v; bedst = d2;
      }
      if (bedst !== null) { f.x += DX[bedst]; f.y += DY[bedst]; ev(s, 'fjendeGaar', { fjende: f.type }); }
    });
  }

  // Et træk. Returnerer { ok, tur } – tur = om fjenderne fik en tur.
  function act(s, a) {
    s.haendelser = [];
    if (s.fase !== 'spil') return { ok: false, tur: false };
    var p = s.spiller, brugt = false;
    s.fjender.forEach(function (f) { f.px = f.x; f.py = f.y; });
    s.forrige = { x: p.x, y: p.y, dir: p.dir };
    if (a === 'frem') brugt = flyt(s, p.dir);
    else if (a === 'tilbage') brugt = flyt(s, (p.dir + 2) % 4);
    else if (a === 'venstre') brugt = flyt(s, (p.dir + 3) % 4);
    else if (a === 'hoejre') brugt = flyt(s, (p.dir + 1) % 4);
    else if (a === 'drejV') { p.dir = (p.dir + 3) % 4; brugt = true; s.besked = ''; ev(s, 'drej', { side: -1 }); }
    else if (a === 'drejH') { p.dir = (p.dir + 1) % 4; brugt = true; s.besked = ''; ev(s, 'drej', { side: 1 }); }
    else if (a === 'vent') { brugt = true; s.besked = 'Du venter et øjeblik.'; ev(s, 'vent'); }
    else if (a === 'handling') brugt = handling(s);
    else return { ok: false, tur: false };
    if (s.fase === 'butik') return { ok: true, tur: false };
    if (!brugt) return { ok: false, tur: false };
    s.tur++;
    afsloer(s);
    fjendeTur(s);
    afsloer(s);
    return { ok: true, tur: true };
  }

  function handling(s) {
    var k = kontekst(s), p = s.spiller;
    if (k.type === 'skyd') {
      p.ammo--;
      var hit = rnd(s) < k.chance, f = k.fjende, navn = k.navn;
      s.sidsteSkud = { tur: s.tur, traf: hit, x: f.x, y: f.y };
      ev(s, 'skud', { traf: hit });
      // Skuddet høres: fjender i nærheden vågner
      s.fjender.forEach(function (g) { if (manh(g.x, g.y, p.x, p.y) <= 6) g.vaagen = true; });
      if (hit) {
        var dead = skadFjende(s, f, p.vaaben);
        s.besked = dead ? navn + ' er nedkæmpet.' : 'Træf! ' + navn + ' har ' + f.hp + ' liv tilbage.';
        ev(s, 'traf', { fjende: f.type, doed: dead });
      } else { s.besked = 'Skuddet gik forbi.'; ev(s, 'miss'); }
      return true;
    }
    if (k.type === 'slaa') {
      var dead2 = skadFjende(s, k.fjende, 1);
      s.sidsteSkud = { tur: s.tur, traf: true, x: k.fjende.x, y: k.fjende.y, slag: true };
      s.besked = dead2 ? k.navn + ' er nedkæmpet.' : 'Du slår. ' + k.navn + ' har ' + k.fjende.hp + ' liv tilbage.';
      ev(s, 'slag', { doed: dead2 });
      return true;
    }
    if (k.type === 'ingenAmmo') { s.besked = 'Du har ingen ammunition. Gå tæt på for at slå, eller find ammo.'; ev(s, 'bump'); return false; }
    if (k.type === 'aabn') { s.cells[idx(s, k.x, k.y)] = AABEN; s.besked = 'Døren går op.'; ev(s, 'doer'); return true; }
    if (k.type === 'aabnLaast') { s.cells[idx(s, k.x, k.y)] = AABEN; s.besked = 'Nøglekortet virker. Døren til trappen er åben.'; ev(s, 'doer', { laast: true }); return true; }
    if (k.type === 'laast') { s.besked = 'Døren er låst. Find nøglekortet først.'; ev(s, 'bump'); return false; }
    if (k.type === 'saml') return flyt(s, p.dir);
    if (k.type === 'tilTrappe') { if (!flyt(s, p.dir)) return false; return gaaNed(s); }
    if (k.type === 'ned') return gaaNed(s);
    s.besked = 'Du venter et øjeblik.'; ev(s, 'vent');
    return true;
  }
  function gaaNed(s) {
    s.fase = 'butik';
    s.dybde = s.etage + 1;
    s.besked = 'Du gik ned ad trappen.';
    ev(s, 'trappe');
    return true;
  }

  // ---------- Butik ----------
  function pris(s, v) { var n = s.koebt[v.id] || 0; return Math.round(v.pris * (1 + 0.4 * n) / 5) * 5; }
  function butik(s) {
    var p = s.spiller;
    return BUTIK.map(function (v) {
      var o = { id: v.id, navn: v.navn, tekst: v.tekst, pris: pris(s, v), kan: true, grund: '' };
      if (v.id === 'heal' && p.hp >= p.maxHp) { o.kan = false; o.grund = 'Fuldt liv'; }
      if (v.id === 'ammo' && p.ammo >= p.maxAmmo) { o.kan = false; o.grund = 'Fuldt magasin'; }
      if (v.id === 'vaaben' && p.vaaben >= RULES.maxVaaben) { o.kan = false; o.grund = 'Bedste våben'; }
      if (v.id === 'rustning' && p.rustning >= RULES.maxRustning) { o.kan = false; o.grund = 'Fuld rustning'; }
      if (v.id === 'lygte' && p.lygte >= RULES.maxLygte) { o.kan = false; o.grund = 'Bedste lygte'; }
      if (o.kan && s.skat < o.pris) { o.kan = false; o.grund = 'For lidt skat'; }
      return o;
    });
  }
  function koeb(s, id) {
    if (s.fase !== 'butik') return false;
    var v = butik(s).filter(function (o) { return o.id === id; })[0];
    if (!v || !v.kan) return false;
    var p = s.spiller;
    s.skat -= v.pris;
    s.koebt[id] = (s.koebt[id] || 0) + 1;
    if (id === 'liv') { p.maxHp += 3; p.hp += 3; }
    else if (id === 'heal') p.hp = p.maxHp;
    else if (id === 'vaaben') p.vaaben++;
    else if (id === 'magasin') { p.maxAmmo += 4; p.ammo = Math.min(p.maxAmmo, p.ammo + 4); }
    else if (id === 'ammo') p.ammo = Math.min(p.maxAmmo, p.ammo + 6);
    else if (id === 'rustning') p.rustning++;
    else if (id === 'lygte') p.lygte++;
    return true;
  }
  function naesteEtage(s) {
    if (s.fase !== 'butik') return false;
    s.etage++;
    s.fase = 'spil';
    s.sidsteSkade = null; s.sidsteSkud = null;
    nyEtage(s);
    s.besked = 'Etage ' + s.etage + '. Find nøglekortet, og åbn den låste dør til trappen.';
    return true;
  }

  // ---------- Kig-og-gå: vej gennem udforskede felter ----------
  // Returnerer felterne, der skal gås igennem (uden startfeltet). nabo: slut ved siden af målet.
  function rute(s, tx, ty, opts) {
    opts = opts || {};
    var p = s.spiller, N = s.W * s.H, prev = new Array(N).fill(-2), q = [idx(s, p.x, p.y)];
    prev[q[0]] = -1;
    var maal = -1;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], x = c % s.W, y = Math.floor(c / s.W);
      if (opts.nabo ? manh(x, y, tx, ty) === 1 : (x === tx && y === ty)) { maal = c; break; }
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d]; if (!inside(s, nx, ny)) continue;
        var k = idx(s, nx, ny);
        if (prev[k] !== -2 || !s.udforsket[k] || !gaaelig(s.cells[k])) continue;
        if (fjendeVed(s, nx, ny)) continue;
        prev[k] = c; q.push(k);
      }
    }
    if (maal < 0) return null;
    var out = [];
    for (var k2 = maal; prev[k2] !== -1; k2 = prev[k2]) out.unshift({ x: k2 % s.W, y: Math.floor(k2 / s.W) });
    return out;
  }
  // Næste træk for at gå ét felt ad ruten (drej først, så man ser, hvor man går)
  function trinMod(s, x, y) {
    var p = s.spiller, dx = x - p.x, dy = y - p.y, d = -1;
    for (var i = 0; i < 4; i++) if (DX[i] === Math.sign(dx) && DY[i] === Math.sign(dy) && (dx === 0 || dy === 0)) d = i;
    if (d < 0) return null;
    if (d === p.dir) return 'frem';
    return ((d - p.dir + 4) % 4) === 1 ? 'drejH' : 'drejV';
  }

  function point(s) { return s.etage * RULES.pointPrEtage + s.skatIalt; }
  function slut(s) { return { score: point(s), etage: s.etage, skat: s.skatIalt, drab: s.drab, ture: s.tur }; }

  function createRun(opts) {
    opts = opts || {};
    var seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    var s = newState(seed);
    return {
      state: s,
      act: function (a) { return act(s, a); },
      kontekst: function () { return kontekst(s); },
      foran: function () { return foran(s); },
      trusler: function () { return trusler(s); },
      butik: function () { return butik(s); },
      koeb: function (id) { return koeb(s, id); },
      naesteEtage: function () { return naesteEtage(s); },
      rute: function (x, y, o) { return rute(s, x, y, o); },
      trinMod: function (x, y) { return trinMod(s, x, y); },
      point: function () { return point(s); },
      end: function () { return slut(s); }
    };
  }

  root.KaelderLogik = {
    VAEG: VAEG, GULV: GULV, DOER: DOER, AABEN: AABEN, LAAST: LAAST, DX: DX, DY: DY, RETNING: RETNING,
    FJENDER: FJENDER, TING: TING, RULES: RULES, BUTIK: BUTIK,
    newState: newState, createRun: createRun, act: act, kontekst: kontekst, foran: foran, trusler: trusler,
    butik: butik, koeb: koeb, naesteEtage: naesteEtage, rute: rute, trinMod: trinMod,
    validerEtage: validerEtage, naaelige: naaelige, cell: cell, fjendeVed: fjendeVed, tingVed: tingVed,
    gaaelig: gaaelig, sigt: sigt, maalForan: maalForan, traefChance: traefChance, point: point, idx: idx, ligeLinje: ligeLinje
  };
})(typeof window !== 'undefined' ? window : globalThis);
