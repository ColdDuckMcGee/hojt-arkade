/*
 * Kabalen – spillogik (Klondike). Ingen DOM, ingen farver, ingen grafik.
 *
 * Kort: et tal 0–51. kulør = floor(k / 13) (0 spar, 1 hjerter, 2 klør, 3 ruder),
 * værdi = k % 13 (0 = es … 12 = konge). Rød = hjerter og ruder (kulør 1 og 3).
 *
 * Tilstand:
 *   t     7 bunker { d: antal kort med bagsiden op (nederst), c: [kort nederst → øverst] }
 *   f     4 grundbunker: antal kort pr. kulør (0–13)
 *   talon bunken og bunken med vendte kort i én liste; w = antal vendte kort.
 *         Vendte kort = talon[0..w-1] (øverste = talon[w-1]); bunken = talon[w..].
 *   draw  1 eller 3 (træk 1 eller træk 3)
 *
 * Træk (move): { k: 'tt', from, n, to } bunke → bunke (n kort) · { k: 'tf', from } bunke → grundbunke
 *   · { k: 'wt', to } vendt kort → bunke · { k: 'wf' } vendt kort → grundbunke
 *   · { k: 'ft', s, to } grundbunke → bunke · { k: 'draw' } træk fra bunken (eller vend bunken).
 *   Talonens træk kan have p (position w), som løseren bruger: "træk frem til w = p, og spil kortet".
 *
 * Point (Windows-standard): kort til grundbunke +10, vendt kort i en bunke +5,
 * fra bunken (talon) til en bunke +5, fra grundbunke tilbage til en bunke −15.
 * Fortryd: trækkets point tages tilbage og koster derudover 2 point.
 * Vundet spil: 200 i bonus + (150 − træk) × 2 for få træk (aldrig under 0).
 */
(function (global) {
  'use strict';

  var POINT = { grund: 10, vend: 5, talon: 5, tilbage: -15, fortryd: -2, sejr: 200, faaTraekGraense: 150, faaTraekFaktor: 2 };
  var VAERDI = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var VAERDINAVN = ['es', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'knægt', 'dame', 'konge'];
  var KULOR = ['spar', 'hjerter', 'klor', 'ruder'];
  var KULORNAVN = ['spar', 'hjerter', 'klør', 'ruder'];

  function suit(k) { return (k / 13) | 0; }
  function rank(k) { return k % 13; }
  function red(k) { return (suit(k) & 1) === 1; }
  function kort(s, r) { return s * 13 + r; }
  function navn(k) { return KULORNAVN[suit(k)] + ' ' + VAERDINAVN[rank(k)]; }
  function kortTekst(k) { return VAERDI[rank(k)] + ['♠', '♥', '♣', '♦'][suit(k)]; }
  // Kan kort a lægges på kort b i en bunke? (én lavere og modsat farve)
  function stacks(a, b) { return rank(a) === rank(b) - 1 && red(a) !== red(b); }

  // ---------- Tilfældighed (seed) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Tilstand ----------
  function clone(s) {
    return { t: s.t.map(function (p) { return { d: p.d, c: p.c.slice() }; }), f: s.f.slice(), talon: s.talon.slice(), w: s.w, draw: s.draw };
  }
  // Et helt tilfældigt tal 0 … n-1 fra browserens kryptografiske tilfældighed
  // (crypto.getRandomValues). Afvisning af de øverste værdier giver en jævn fordeling
  // uden skævhed. Findes crypto ikke, bruges Math.random.
  function randInt(n) {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && c.getRandomValues) {
      var buf = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
      do { c.getRandomValues(buf); } while (buf[0] >= lim);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  // Ren Fisher–Yates-blanding. r() er en funktion, der giver et tal i [0, 1) (seed, til test),
  // eller udeladt: så bruges randInt (kryptografisk tilfældighed). Ingen spil sorteres fra:
  // det er helt tilfældigt, om et spil kan vindes.
  function shuffle(r) {
    var deck = [];
    for (var i = 0; i < 52; i++) deck.push(i);
    for (var j = 51; j > 0; j--) { var x = r ? Math.floor(r() * (j + 1)) : randInt(j + 1), tmp = deck[j]; deck[j] = deck[x]; deck[x] = tmp; }
    return deck;
  }
  function deal(r, draw) {
    var deck = shuffle(r);
    var s = { t: [], f: [0, 0, 0, 0], talon: [], w: 0, draw: draw === 3 ? 3 : 1 }, n = 0;
    for (var c = 0; c < 7; c++) s.t.push({ d: c, c: deck.slice(n, n + c + 1) }), n += c + 1;
    s.talon = deck.slice(n);
    return s;
  }
  function top(p) { return p.c.length ? p.c[p.c.length - 1] : -1; }
  function wasteTop(s) { return s.w > 0 ? s.talon[s.w - 1] : -1; }
  function foundationTotal(s) { return s.f[0] + s.f[1] + s.f[2] + s.f[3]; }
  function downTotal(s) { var n = 0; for (var i = 0; i < 7; i++) n += s.t[i].d; return n; }
  function won(s) { return foundationTotal(s) === 52; }
  // Alt er vendt, og bunken er tom: spillet kan altid lægges færdigt
  function allOpen(s) { return s.talon.length === 0 && downTotal(s) === 0; }
  function canFound(s, k) { return k >= 0 && s.f[suit(k)] === rank(k); }
  function canTab(s, k, col) {
    var p = s.t[col];
    if (!p.c.length) return rank(k) === 12;
    return stacks(k, top(p));
  }
  // Et kort på grundbunken kan ikke længere skade: begge modsatte farver er nået op til værdi − 1
  // (og den anden af samme farve til værdi − 2). Es og 2'ere er altid sikre.
  function safe(s, k) {
    var r = rank(k);
    if (!canFound(s, k)) return false;
    if (r <= 1) return true;
    var su = suit(k), o1 = (su + 1) % 4, o2 = (su + 3) % 4, same = (su + 2) % 4;
    return s.f[o1] >= r - 1 && s.f[o2] >= r - 1 && s.f[same] >= r - 2;
  }

  // Næste w ved et klik på bunken (træk 1 eller 3; tom bunke = vend den om)
  function nextW(s, w) { return w >= s.talon.length ? 0 : Math.min(s.talon.length, w + s.draw); }
  // Alle positioner, hvor et vendt kort kan nås ved at klikke på bunken (fra w nu), inkl. nu
  function reachable(s) {
    var seen = {}, out = [], w = s.w, n = 0;
    if (!s.talon.length) return out;
    while (!seen[w] && n++ < 200) {
      seen[w] = true;
      if (w > 0) out.push(w);
      w = nextW(s, w);
    }
    return out;
  }

  // ---------- Træk ----------
  // Udfører et træk direkte på s. Returnerer { pts, flip } eller null, hvis trækket er ulovligt.
  function apply(s, m) {
    var pts = 0, flip = false, k, p, q;
    function fromCol(col, n) {
      p = s.t[col];
      var moved = p.c.splice(p.c.length - n, n);
      if (p.c.length && p.c.length === p.d) { p.d--; flip = true; pts += POINT.vend; }
      else if (!p.c.length && p.d) p.d = 0;
      return moved;
    }
    function fromTalon() {
      if (m.p !== undefined) s.w = m.p;
      var c = s.talon.splice(s.w - 1, 1)[0];
      s.w--;
      return c;
    }
    switch (m.k) {
      case 'draw':
        if (!s.talon.length) return null;
        s.w = nextW(s, s.w);
        break;
      case 'tt':
        p = s.t[m.from]; q = s.t[m.to];
        if (m.from === m.to || m.n < 1 || m.n > p.c.length - p.d) return null;
        k = p.c[p.c.length - m.n];
        if (!canTab(s, k, m.to)) return null;
        q.c.push.apply(q.c, fromCol(m.from, m.n));
        break;
      case 'tf':
        k = top(s.t[m.from]);
        if (!canFound(s, k) || s.t[m.from].c.length <= s.t[m.from].d) return null;
        fromCol(m.from, 1); s.f[suit(k)]++; pts += POINT.grund;
        break;
      case 'wt':
        k = m.p !== undefined ? (m.p > 0 ? s.talon[m.p - 1] : -1) : wasteTop(s);
        if (k < 0 || !canTab(s, k, m.to)) return null;
        s.t[m.to].c.push(fromTalon()); pts += POINT.talon;
        break;
      case 'wf':
        k = m.p !== undefined ? (m.p > 0 ? s.talon[m.p - 1] : -1) : wasteTop(s);
        if (!canFound(s, k)) return null;
        fromTalon(); s.f[suit(k)]++; pts += POINT.grund;
        break;
      case 'ft':
        if (!s.f[m.s]) return null;
        k = kort(m.s, s.f[m.s] - 1);
        if (!canTab(s, k, m.to)) return null;
        s.f[m.s]--; s.t[m.to].c.push(k); pts += POINT.tilbage;
        break;
      default: return null;
    }
    return { pts: pts, flip: flip };
  }

  // Alle lovlige træk med kort (uden 'draw'), for den aktuelle w
  function cardMoves(s) {
    var out = [], i, j, n, p, k, wt = wasteTop(s);
    for (i = 0; i < 7; i++) {
      p = s.t[i];
      if (p.c.length > p.d && canFound(s, top(p))) out.push({ k: 'tf', from: i });
    }
    if (canFound(s, wt)) out.push({ k: 'wf' });
    for (i = 0; i < 7; i++) {
      p = s.t[i];
      for (n = p.c.length - p.d; n >= 1; n--) {
        k = p.c[p.c.length - n];
        for (j = 0; j < 7; j++) if (j !== i && canTab(s, k, j)) out.push({ k: 'tt', from: i, n: n, to: j });
      }
    }
    if (wt >= 0) for (j = 0; j < 7; j++) if (canTab(s, wt, j)) out.push({ k: 'wt', to: j });
    for (var su = 0; su < 4; su++) if (s.f[su]) for (j = 0; j < 7; j++) if (canTab(s, kort(su, s.f[su] - 1), j)) out.push({ k: 'ft', s: su, to: j });
    return out;
  }

  // ---------- Løser ----------
  // Dybde-først søgning med husket tilstand. Sikre kort lægges op af sig selv undervejs.
  // Talonen behandles som "alle kort, der kan nås ved at klikke på bunken" (ubegrænset antal
  // gennemløb), så bunken ikke skal søges kort for kort. Grundbunke → bunke bruges ikke (løseren
  // er derfor lidt forsigtig: "vundet" er et bevis, "umulig" betyder kun "ikke fundet").
  function key(s) {
    var cols = [];
    for (var i = 0; i < 7; i++) cols.push(s.t[i].d + String.fromCharCode.apply(null, s.t[i].c.map(function (c) { return 48 + c; })));
    cols.sort();
    return cols.join('|') + '#' + String.fromCharCode.apply(null, s.talon.map(function (c) { return 48 + c; })) + (s.draw === 1 ? '' : '/' + s.w);
  }
  function autoSafe(s, log) {
    var moved = true;
    while (moved) {
      moved = false;
      for (var i = 0; i < 7; i++) {
        var p = s.t[i];
        if (p.c.length > p.d && safe(s, top(p))) { apply(s, { k: 'tf', from: i }); if (log) log.push({ k: 'tf', from: i }); moved = true; }
      }
      if (safe(s, wasteTop(s))) { apply(s, { k: 'wf' }); if (log) log.push({ k: 'wf' }); moved = true; }
    }
  }
  function solverMoves(s) {
    var out = [], i, j, p, k, n, pos = reachable(s), firstEmpty = -1, kingWaiting = false;
    for (j = 0; j < 7; j++) if (!s.t[j].c.length) { firstEmpty = j; break; }
    // A: til grundbunken
    for (i = 0; i < 7; i++) { p = s.t[i]; if (p.c.length > p.d && canFound(s, top(p))) out.push({ k: 'tf', from: i }); }
    pos.forEach(function (w) { if (canFound(s, s.talon[w - 1])) out.push({ k: 'wf', p: w }); });
    // B: hele den åbne del flyttes, så et kort vendes (bunker med flest skjulte kort først)
    var order = [0, 1, 2, 3, 4, 5, 6].sort(function (a, b) { return s.t[b].d - s.t[a].d; });
    order.forEach(function (i) {
      var p = s.t[i]; if (!p.d || p.c.length <= p.d) return;
      var k = p.c[p.d], n = p.c.length - p.d;
      for (var j = 0; j < 7; j++) {
        if (j === i) continue;
        if (!s.t[j].c.length) { if (rank(k) === 12 && j === firstEmpty) out.push({ k: 'tt', from: i, n: n, to: j }); }
        else if (stacks(k, top(s.t[j]))) out.push({ k: 'tt', from: i, n: n, to: j });
      }
    });
    // C: fra talonen til en bunke
    pos.forEach(function (w) {
      var c = s.talon[w - 1];
      if (rank(c) === 12) kingWaiting = true;
      for (var j = 0; j < 7; j++) {
        if (!s.t[j].c.length) { if (rank(c) === 12 && j === firstEmpty) out.push({ k: 'wt', p: w, to: j }); }
        else if (stacks(c, top(s.t[j]))) out.push({ k: 'wt', p: w, to: j });
      }
    });
    // D: dele af en åben række, så kortet nedenunder kan lægges op · tøm en bunke uden skjulte kort
    for (i = 0; i < 7; i++) {
      p = s.t[i];
      for (n = p.c.length - p.d - 1; n >= 1; n--) {
        k = p.c[p.c.length - n];
        if (!canFound(s, p.c[p.c.length - n - 1])) continue;
        for (j = 0; j < 7; j++) if (j !== i && s.t[j].c.length && stacks(k, top(s.t[j]))) out.push({ k: 'tt', from: i, n: n, to: j });
      }
      if (!p.d && p.c.length && rank(p.c[0]) !== 12) {
        for (j = 0; j < 7; j++) if (j !== i && s.t[j].c.length && stacks(p.c[0], top(s.t[j]))) out.push({ k: 'tt', from: i, n: p.c.length, to: j });
      }
    }
    if (!kingWaiting) { /* tom plads uden konge at lægge: intet ekstra */ }
    return out;
  }
  // Løser, der kan køres i bidder (step), så brugerfladen ikke fryser.
  function createSolver(start, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || 60000;
    var s0 = clone(start), log0 = [];
    autoSafe(s0, log0);
    var seen = new Set(), nodes = 0, status = 'running', path = null;
    var stack = [{ s: s0, moves: null, i: 0, via: log0 }];
    seen.add(key(s0));
    function done(st) { status = st; return st; }
    function step(budget) {
      if (status !== 'running') return status;
      var end = nodes + (budget || maxNodes);
      while (stack.length) {
        var fr = stack[stack.length - 1];
        if (!fr.moves) {
          if (won(fr.s) || allOpen(fr.s)) {
            path = [];
            stack.forEach(function (f) { path.push.apply(path, f.via); });
            return done('vundet');
          }
          fr.moves = solverMoves(fr.s);
        }
        if (fr.i >= fr.moves.length) { stack.pop(); continue; }
        var m = fr.moves[fr.i++];
        var c = clone(fr.s);
        if (!apply(c, m)) continue;
        var via = [m];
        autoSafe(c, via);
        var kk = key(c);
        if (seen.has(kk)) continue;
        seen.add(kk);
        stack.push({ s: c, moves: null, i: 0, via: via });
        if (++nodes >= maxNodes) return done('graense');
        if (nodes >= end) return status;
      }
      return done('umulig');
    }
    return { step: step, get status() { return status; }, get path() { return path; }, get nodes() { return nodes; } };
  }
  function solve(s, opts) { var sv = createSolver(s, opts); sv.step(); return { status: sv.status, path: sv.path, nodes: sv.nodes }; }

  // ---------- Sidder man fast? ----------
  // Søger alle tilstande, man kan nå uden "fremskridt" (bunker flyttes rundt, kort fra
  // grundbunken tages ned). Fremskridt = et kort vendes, et kort lægges på grundbunken (flere end
  // ved start), eller et kort fra bunken (talonen) bruges. Findes intet fremskridt, sidder man fast.
  function hasProgress(start, limit) {
    limit = limit || 4000;
    var pos = reachable(start), f0 = foundationTotal(start);
    var talonCards = pos.map(function (w) { return start.talon[w - 1]; });
    var seen = new Set(), queue = [start], qi = 0;
    function tkey(s) { var a = []; for (var i = 0; i < 7; i++) a.push(s.t[i].d + ':' + s.t[i].c.join(',')); return a.join('|') + '#' + s.f.join(','); }
    seen.add(tkey(start));
    while (qi < queue.length) {
      var s = queue[qi++];
      if (foundationTotal(s) > f0) return true;
      // Kan et kort fra bunken bruges?
      for (var a = 0; a < talonCards.length; a++) {
        var c = talonCards[a];
        if (canFound(s, c)) return true;
        for (var j = 0; j < 7; j++) if (canTab(s, c, j)) return true;
      }
      var ms = cardMoves(s);
      for (var b = 0; b < ms.length; b++) {
        var m = ms[b];
        if (m.k === 'wt' || m.k === 'wf') return true;
        if (m.k === 'tf') return true;
        var c2 = clone(s), r = apply(c2, m);
        if (!r) continue;
        if (r.flip) return true;
        // Ubrugelige træk: en konge, der allerede ligger nederst, flyttes til en tom plads
        var kk = tkey(c2);
        if (seen.has(kk)) continue;
        seen.add(kk);
        if (seen.size > limit) return true; // for mange muligheder: regn med, at der er en vej
        queue.push(c2);
      }
    }
    return false;
  }

  // ---------- Ét spil ----------
  function createGame(opts) {
    opts = opts || {};
    var s = opts.deal ? clone(opts.deal) : deal(opts.seed ? rng(opts.seed) : null, opts.draw);
    var hist = [];
    var g = {
      points: 0, moves: 0, undos: 0, draws: 0, flips: 0, toFoundation: 0, lastRes: null,
      get state() { return s; }
    };
    function snapshot() { hist.push({ s: clone(s), points: g.points, moves: g.moves, draws: g.draws, flips: g.flips, toFoundation: g.toFoundation }); }
    // Et træk fra spilleren. countMove: om det tæller som et træk (træk fra bunken gør ikke).
    g.play = function (m) {
      var c = clone(s), r = apply(c, m);
      if (!r) return { ok: false };
      snapshot();
      s = c;
      g.points += r.pts;
      if (m.k === 'draw') g.draws++; else g.moves++;
      if (r.flip) g.flips++;
      if (m.k === 'tf' || m.k === 'wf') g.toFoundation++;
      if (m.k === 'ft') g.toFoundation--;
      g.lastRes = r;
      return { ok: true, pts: r.pts, flip: r.flip, won: won(s) };
    };
    g.draw = function () { return g.play({ k: 'draw' }); };
    // Saml: læg alle sikre kort op. Er ingen sikre, lægges de kort op, der kan (ét samlet træk).
    g.collect = function () {
      var c = clone(s), log = [], pts = 0, flips = 0;
      function run(test) {
        var moved = true;
        while (moved) {
          moved = false;
          for (var i = 0; i < 7; i++) {
            var p = c.t[i];
            if (p.c.length > p.d && test(c, top(p))) { var r = apply(c, { k: 'tf', from: i }); pts += r.pts; if (r.flip) flips++; log.push({ k: 'tf', from: i }); moved = true; }
          }
          if (test(c, wasteTop(c))) { pts += apply(c, { k: 'wf' }).pts; log.push({ k: 'wf' }); moved = true; }
        }
      }
      run(safe);
      if (!log.length) run(canFound);
      if (!log.length) return { ok: false, n: 0 };
      snapshot();
      s = c; g.points += pts; g.moves++; g.flips += flips; g.toFoundation += log.length;
      return { ok: true, n: log.length, pts: pts, log: log, won: won(s) };
    };
    // Automatisk afslutning (alt er vendt): ét kort ad gangen, tæller ikke som træk
    g.autoStep = function () {
      if (!allOpen(s) || won(s)) return null;
      var best = -1, bestR = 99;
      for (var i = 0; i < 7; i++) { var k = top(s.t[i]); if (canFound(s, k) && rank(k) < bestR) { best = i; bestR = rank(k); } }
      if (best < 0) return null;
      var r = apply(s, { k: 'tf', from: best });
      g.points += r.pts; g.toFoundation++;
      return { from: best, won: won(s) };
    };
    g.canUndo = function () { return hist.length > 0; };
    g.undo = function () {
      if (!hist.length) return { ok: false };
      var h = hist.pop();
      s = h.s; g.points = h.points; g.moves = h.moves; g.draws = h.draws; g.flips = h.flips; g.toFoundation = h.toFoundation;
      g.undos++;
      return { ok: true };
    };
    // Point for spillet: trækkenes point − fortryd
    g.score = function () { return g.points + g.undos * POINT.fortryd; };
    g.winBonus = function () {
      var few = Math.max(0, POINT.faaTraekGraense - g.moves) * POINT.faaTraekFaktor;
      return { sejr: POINT.sejr, faaTraek: few, ialt: POINT.sejr + few };
    };
    g.won = function () { return won(s); };
    g.allOpen = function () { return allOpen(s); };
    g.stuck = function () { return !won(s) && !hasProgress(s); };
    // Lovlige mål for et kort. src: { k: 't', col, idx } · { k: 'w' } · { k: 'f', s }
    g.targets = function (src) { return targetsFor(s, src); };
    g.moveFor = function (src, dest) { return moveFor(s, src, dest); };
    // Hint: løserens første træk; ellers det bedste enkle træk
    g.hint = function (maxNodes) { return hint(s, maxNodes); };
    return g;
  }

  function srcCards(s, src) {
    if (src.k === 't') { var p = s.t[src.col]; if (src.idx < p.d || src.idx >= p.c.length) return null; return p.c.slice(src.idx); }
    if (src.k === 'w') { var w = wasteTop(s); return w < 0 ? null : [w]; }
    if (src.k === 'f') { return s.f[src.s] ? [kort(src.s, s.f[src.s] - 1)] : null; }
    return null;
  }
  function moveFor(s, src, dest) {
    var cards = srcCards(s, src);
    if (!cards) return null;
    var m = null;
    if (dest.k === 'f') {
      if (cards.length !== 1 || src.k === 'f') return null;
      m = src.k === 't' ? { k: 'tf', from: src.col } : { k: 'wf' };
    } else if (dest.k === 't') {
      if (src.k === 't') m = { k: 'tt', from: src.col, n: cards.length, to: dest.col };
      else if (src.k === 'w') m = { k: 'wt', to: dest.col };
      else m = { k: 'ft', s: src.s, to: dest.col };
    }
    if (!m) return null;
    return apply(clone(s), m) ? m : null;
  }
  function targetsFor(s, src) {
    var out = [];
    if (moveFor(s, src, { k: 'f' })) out.push({ k: 'f', s: suit(srcCards(s, src)[0]) });
    for (var j = 0; j < 7; j++) if (moveFor(s, src, { k: 't', col: j })) out.push({ k: 't', col: j });
    return out;
  }
  function hint(s, maxNodes) {
    var res = solve(s, { maxNodes: maxNodes || 15000 });
    if (res.status === 'vundet' && res.path.length) {
      var m = res.path[0];
      if ((m.k === 'wt' || m.k === 'wf') && m.p !== undefined && m.p !== s.w) return { k: 'draw', kilde: 'loeser' };
      if (m.p !== undefined) { m = Object.assign({}, m); delete m.p; }
      return Object.assign({ kilde: 'loeser' }, m);
    }
    // Ingen løsning fundet: et enkelt, fornuftigt træk
    var ms = cardMoves(s), best = null, bestV = -1;
    ms.forEach(function (m) {
      var c = clone(s), r = apply(c, m), v = 0;
      if (!r) return;
      if (m.k === 'tf' || m.k === 'wf') v = 50;
      else if (r.flip) v = 40;
      else if (m.k === 'wt') v = 30;
      else if (m.k === 'tt' && !s.t[m.to].c.length && s.t[m.from].d === 0 && s.t[m.from].c.length === m.n) v = -1; // konge flyttes fra tom plads til tom plads
      else if (m.k === 'tt' && m.n === s.t[m.from].c.length - s.t[m.from].d && s.t[m.from].d === 0) v = 10;
      else v = m.k === 'ft' ? 1 : 5;
      if (v > bestV) { bestV = v; best = m; }
    });
    if (best && bestV >= 10) return Object.assign({ kilde: 'simpel' }, best);
    if (s.talon.length && reachable(s).some(function (w) { var c = s.talon[w - 1]; if (canFound(s, c)) return true; for (var j = 0; j < 7; j++) if (canTab(s, c, j)) return true; return false; }) && !(best && bestV >= 30)) return { k: 'draw', kilde: 'simpel' };
    if (best && bestV >= 0) return Object.assign({ kilde: 'simpel' }, best);
    return null;
  }

  // ---------- Serien ----------
  // Spil efter spil: vinder man, lægges spillets point og sejrsbonus til, og næste spil gives.
  // Serien slutter, når man giver op, eller når man sidder fast. Så gemmes summen på top 10.
  function createSeries(opts) {
    opts = opts || {};
    var draw = opts.draw === 3 ? 3 : 1;
    var se = { draw: draw, banked: 0, games: 0, wins: 0, game: null, over: false, history: [] };
    se.start = function (dealState, seed) {
      se.game = createGame({ deal: dealState, seed: seed, draw: draw });
      se.games++;
      return se.game;
    };
    se.total = function () { return Math.max(0, se.banked + (se.game && !se.game.banked ? se.game.score() : 0)); };
    se.winGame = function () {
      var g = se.game;
      if (!g || !g.won() || g.banked) return null;
      var b = g.winBonus(), gameScore = g.score() + b.ialt;
      se.banked = Math.max(0, se.banked + gameScore);
      g.banked = true; se.wins++;
      var rec = { score: gameScore, kort: g.score(), bonus: b, moves: g.moves, undos: g.undos };
      se.history.push(rec);
      return rec;
    };
    se.end = function (why) {
      if (se.over) return null;
      se.over = true;
      if (se.game && !se.game.banked) { se.banked = Math.max(0, se.banked + se.game.score()); se.game.banked = true; }
      return { score: se.banked, wins: se.wins, games: se.games, why: why };
    };
    return se;
  }

  global.KabaleLogik = {
    POINT: POINT, VAERDI: VAERDI, VAERDINAVN: VAERDINAVN, KULOR: KULOR, KULORNAVN: KULORNAVN,
    suit: suit, rank: rank, red: red, kort: kort, navn: navn, kortTekst: kortTekst, stacks: stacks,
    rng: rng, deal: deal, clone: clone, apply: apply, cardMoves: cardMoves, reachable: reachable,
    safe: safe, canFound: canFound, canTab: canTab, won: won, allOpen: allOpen, top: top, wasteTop: wasteTop,
    foundationTotal: foundationTotal, downTotal: downTotal,
    createSolver: createSolver, solve: solve, shuffle: shuffle, randInt: randInt, randomDeal: function (draw) { return deal(null, draw); },
    hasProgress: hasProgress, createGame: createGame, createSeries: createSeries, hint: hint, targetsFor: targetsFor, moveFor: moveFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
