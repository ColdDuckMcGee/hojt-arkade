/*
 * Kabalen – brugerflade: skærme, input, layout, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ (samme maskinrum som Sudoku).
 *
 * Styring: vælg et kort (kortene ovenpå følger med), og de lovlige mål lyser op.
 * Vælg så et mål. Er der kun ét mål, flytter kortet derhen, hvis det vælges igen.
 * Der er intet ur. Alle spil kan vindes (løseren tjekker hvert spil, før det gives).
 * Vinder man, fortsætter serien med et nyt spil. Serien slutter, når man giver op
 * eller sidder fast.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.KabaleLogik;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // draw: træk 1 eller 3 kort fra bunken. gloed: temaets glød (kan slås fra; spillet kan læses uden).
  var kset = ArkadeSettings.create('kabalen', { draw: 1, gloed: true });
  var records = ArkadeHighscores.create('kabalen', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (kset.get('draw') !== 1 && kset.get('draw') !== 3) kset.set('draw', 1);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var lastPX = -1, lastPY = -1;
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') { lastPX = e.clientX; lastPY = e.clientY; }
    if (gazeGuard) releaseGuard(e.clientX, e.clientY);
    if (boardGuard && !boardGuardHolds(e.clientX, e.clientY)) { boardGuard = null; renderBoard(); }
  }, { passive: true });
  // Dwell-sikker skift: når kortene flytter sig, kan der ligge et nyt kort præcis dér,
  // hvor blikket allerede er. Det kan ikke dwelles, før blikket har forladt det én gang.
  var gazeGuard = null;
  function guardUnderGaze(scope) {
    releaseGuard();
    if (lastPX < 0) return;
    var el = document.elementFromPoint(lastPX, lastPY);
    var b = el && el.closest('button, a[href]');
    if (b && scope.contains(b) && !b.hasAttribute('data-no-dwell')) { gazeGuard = b; b.setAttribute('data-no-dwell', ''); }
  }
  function releaseGuard(x, y) {
    if (!gazeGuard) return;
    if (x !== undefined) {
      var r = gazeGuard.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return;
    }
    var g = gazeGuard; gazeGuard = null;
    g.removeAttribute('data-no-dwell');
    if (g.classList.contains('kort') || g.classList.contains('plads')) renderBoard(); // tegnelaget styrer kortenes dwell
  }

  // Det samme for spillebordet: efter et træk glider kortene på plads, så det kort, der lander
  // under blikket, først kendes bagefter. Alle kort og pladser, hvis endelige plads dækker
  // blikkets punkt, kan derfor ikke dwelles, før blikket har forladt dem.
  var boardGuard = null;
  function finalRect(el) {
    var m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform || '');
    if (!m) return el.getBoundingClientRect();
    var br = boardEl.getBoundingClientRect(), x = br.left + boardEl.clientLeft + (+m[1]), y = br.top + boardEl.clientTop + (+m[2]);
    return { left: x, top: y, right: x + parseFloat(el.style.width || 0), bottom: y + parseFloat(el.style.height || 0) };
  }
  function inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  function boardGuardEls() {
    var out = [];
    if (!boardGuard) return out;
    boardEl.querySelectorAll('.kort, .plads').forEach(function (el) {
      if (el.classList.contains('gemt')) return;
      var r = finalRect(el);
      if (inRect(r, boardGuard.x, boardGuard.y)) out.push({ el: el, r: r });
    });
    return out;
  }
  function boardGuardHolds(x, y) { return boardGuardEls().some(function (g) { return inRect(g.r, x, y); }); }
  function guardBoard() {
    boardGuard = (lastPX >= 0 && dwell.isEnabled()) ? { x: lastPX, y: lastPY } : null;
    applyBoardGuard();
  }
  function applyBoardGuard() {
    var els = boardGuardEls();
    if (!els.length) { boardGuard = null; return; }
    els.forEach(function (g) { g.el.setAttribute('data-no-dwell', ''); });
  }

  // Musik fra det fælles lydmodul, spillets egne lyde fra js/lyd.js
  var audio = ArkadeAudio.create({ sfx: false, music: arkade.get('music') });
  var lyd = KabaleLyd.create({ sfx: arkade.get('sound'), lyde: KabaleTema.lyde });
  function sfx(name, n) { lyd.play(name, n); }
  function unlockAudio() { audio.unlock(); lyd.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function cssNum(name, fb) { var v = parseFloat(cssVar(name)); return isNaN(v) ? fb : v; }
  function animationOn() { return arkade.get('animation') && !reducedMotionMq.matches; }
  function applyTheme() {
    root.setAttribute('data-theme', arkade.get('theme'));
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = cssVar('--bg');
    bg.setPalette({
      bg0: cssVar('--p-bg0'), bg1: cssVar('--p-bg1'), sky0: cssVar('--p-sky0'), sky1: cssVar('--p-sky1'),
      sky2: cssVar('--p-sky2'), sun0: cssVar('--p-sun0'), sun1: cssVar('--p-sun1'), grid: cssVar('--p-grid'),
      light1: cssVar('--p-light1'), light2: cssVar('--p-light2')
    });
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    root.classList.toggle('ka-rolig', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden, og kortene glider på plads. Fra giver faste skift';
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);

  arkade.onChange(function (key, value) {
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') dwell.setEnabled(value);
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') lyd.setSfx(value);
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-ka-gloed', kset.get('gloed') ? 'til' : 'fra'); }
  kset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'draw') { syncMenu(); prepareFirst(); }
    syncSettingsUi();
  });

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'menu') syncMenu();
    if (id === 'game') layoutGame(); else fitScreen($('#' + id), true);
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function winsText(n) { return n === 1 ? '1 spil vundet' : n + ' spil vundet'; }
  function modeName(d) { return d === 3 ? 'Træk 3' : 'Træk 1'; }
  function cat(d) { return d === 3 ? 'traek3' : 'traek1'; }
  function cardText(k) { return L.VAERDINAVN[L.rank(k)] === 'es' ? L.KULORNAVN[L.suit(k)] + ' es' : L.navn(k); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function currentDraw() { return kset.get('draw') === 3 ? 3 : 1; }

  // ---------- Startmenu ----------
  function syncMenu() {
    var d = currentDraw();
    $$('#menu [data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.mode === d)); });
    $('#start-sub').textContent = modeName(d) + ' · serie uden ende';
    if (current === 'menu') fitScreen($('#menu'));
    if (current === 'menu') prepareFirst();
  }
  $$('#menu [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { kset.set('draw', +b.dataset.mode); syncMenu(); sfx('klik'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('klik'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('klik'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('klik'); openRecords(currentDraw()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('klik');
    audio.setMusic(false);
    [arkade, kset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) audio.setMusic(arkade.get('music'));
  });
  $('#btn-om').addEventListener('click', function () { sfx('klik'); show('om'); });
  $('#btn-om-back').addEventListener('click', function () { sfx('klik'); show('menu'); });

  // ---------- Fuld skærm ----------
  var fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      var p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      if (p && p.catch) p.catch(function () {});
    }
  }
  function syncFullscreen() {
    $$('.js-fs-label').forEach(function (l) { l.textContent = isFullscreen() ? 'Luk fuld skærm' : 'Fuld skærm'; });
  }
  $$('.js-fullscreen').forEach(function (b) {
    if (!fsSupported) { b.hidden = true; return; }
    b.addEventListener('click', function () { sfx('klik'); toggleFullscreen(); });
  });
  function onFs() { syncFullscreen(); if (current === 'menu') syncMenu(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spil, der kan vindes (laves i små bidder, så skærmen ikke fryser) ----------
  // Løseren prøver blandinger, til den finder en, der kan vindes. Arbejdet deles op i
  // korte bidder med setTimeout, mens menuen eller sejrsboksen står fremme.
  var prep = { 1: null, 3: null };
  var SLICE = 3000;
  function newSeed() { return (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0 || 1; }
  function prepare(d, cb) {
    var p = prep[d];
    if (!p) { p = prep[d] = { gen: L.createGenerator(newSeed(), d), timer: 0, cbs: [] }; }
    if (cb) p.cbs.push(cb);
    if (p.gen.result) { flush(d); return; }
    if (p.timer) return;
    (function tick() {
      p.timer = setTimeout(function () {
        p.timer = 0;
        var r = p.gen.step(SLICE);
        if (r) flush(d); else tick();
      }, 0);
    })();
  }
  function flush(d) {
    var p = prep[d];
    if (!p || !p.gen.result || !p.cbs.length) return;
    var cbs = p.cbs; p.cbs = [];
    var r = p.gen.result;
    prep[d] = null;
    cbs[0](r);
    for (var i = 1; i < cbs.length; i++) prepare(d, cbs[i]);
  }
  function takeDeal(d, cb) { prepare(d, cb); }
  var firstTimer = 0;
  function prepareFirst() { clearTimeout(firstTimer); firstTimer = setTimeout(function () { prepare(currentDraw()); }, 200); }

  // ---------- Spillet ----------
  var series = null, game = null, paused = false, finished = false, waiting = false;
  var sel = null, hintMv = null, autoTimer = 0, autoRunning = false, doneTimer = 0, stuckTimer = 0;
  var lastNote = '', noteCls = '', fresh = true, lastDealInfo = null;
  var boardEl = $('#bord'), gameEl = $('#game'), sideEl = $('#side');
  var tegn = KabaleTegn.create(boardEl);

  function startGame() {
    var d = currentDraw();
    series = L.createSeries({ draw: d });
    finished = false; paused = false;
    hideOverlays();
    beginNext(true);
  }
  function beginNext(first) {
    var d = series.draw;
    waiting = true; game = null;
    setNote(first ? 'Blander kortene …' : 'Blander næste spil …', '');
    if (current !== 'game') show('game');
    refresh();
    takeDeal(d, function (r) {
      waiting = false;
      lastDealInfo = r;
      game = series.start(r.deal);
      sel = null; hintMv = null; fresh = true;
      setNote('', '');
      tegn.build();
      hideOverlays();
      if (current !== 'game') show('game'); else layoutGame();
      refresh();
      guardBoard();
      prepare(d); // næste spil laves allerede nu, i små bidder
    });
  }

  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay', '#stuck-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return !!game && !waiting && !paused && !finished && !autoRunning && !game.won() && current === 'game' && !overlayOpen(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  // Hvor ligger kortet? → kilde til et træk
  function locate(k) {
    var s = game.state, i, c;
    for (c = 0; c < 7; c++) { i = s.t[c].c.indexOf(k); if (i >= 0) return { k: 't', col: c, idx: i, up: i >= s.t[c].d }; }
    i = s.talon.indexOf(k);
    if (i >= 0) return i < s.w ? { k: 'w', top: i === s.w - 1 } : { k: 'stock' };
    var su = L.suit(k);
    if (L.rank(k) < s.f[su]) return { k: 'f', s: su, top: L.rank(k) === s.f[su] - 1 };
    return null;
  }
  function srcCards(src) {
    var s = game.state;
    if (src.k === 't') return s.t[src.col].c.slice(src.idx);
    if (src.k === 'w') return [s.talon[s.w - 1]];
    return [L.kort(src.s, s.f[src.s] - 1)];
  }
  function destName(t) { return t.k === 'f' ? 'grundbunken' : 'bunke ' + (t.col + 1); }
  function selectSrc(src) {
    var cards = srcCards(src), targets = game.targets(src);
    sel = { src: src, cards: cards, targets: targets };
    hintMv = null;
    var what = cap(cardText(cards[0])) + (cards.length > 1 ? ' og ' + (cards.length - 1 === 1 ? '1 kort' : (cards.length - 1) + ' kort') + ' ovenpå' : '');
    if (!targets.length) { setNote(what + ' kan ikke flyttes nu. Vælg et andet kort.', 'err'); sfx('nej'); }
    else if (targets.length === 1) { setNote(what + ' kan til ' + destName(targets[0]) + '. Vælg målet eller kortet igen.', ''); sfx('vaelg'); }
    else { setNote(what + ': vælg et af de lysende mål.', ''); sfx('vaelg'); }
    refresh();
  }
  function cancelSel(quiet) { if (!sel) return; sel = null; if (!quiet) { setNote('', ''); sfx('fravaelg'); } refresh(); }
  function sameSrc(a, b) { return a && b && a.k === b.k && a.col === b.col && a.idx === b.idx && a.s === b.s; }
  function findTarget(dest) {
    if (!sel) return null;
    for (var i = 0; i < sel.targets.length; i++) {
      var t = sel.targets[i];
      if (t.k === dest.k && (t.k === 'f' || t.col === dest.col)) return t;
    }
    return null;
  }
  function moveTo(t) {
    var m = game.moveFor(sel.src, t.k === 'f' ? { k: 'f' } : t);
    sel = null;
    if (!m) { refresh(); return; }
    doMove(m);
  }
  function doMove(m) {
    var r = game.play(m);
    hintMv = null;
    if (!r.ok) { sfx('nej'); refresh(); return; }
    if (m.k === 'draw') sfx(game.state.w === 0 ? 'blandom' : 'traek');
    else if (m.k === 'tf' || m.k === 'wf') sfx('grund', game.state.f.reduce(function (a, b) { return Math.max(a, b); }, 0));
    else sfx(r.flip ? 'vend' : 'laeg');
    var pt = r.pts;
    if (m.k !== 'draw') setNote(pt > 0 ? '+' + pointsText(pt) + (r.flip ? ' · kort vendt' : '') : pt < 0 ? '−' + pointsText(-pt) + ' (kort taget ned fra grundbunken)' : '', pt > 0 ? 'ok' : pt < 0 ? 'err' : '');
    else setNote('', '');
    afterMove();
  }
  function afterMove() {
    fresh = false;
    refresh();
    guardBoard();
    if (game.won()) { wonNow(); return; }
    if (game.allOpen()) { startAuto(); return; }
    clearTimeout(stuckTimer);
    stuckTimer = setTimeout(checkStuck, 30);
  }
  function checkStuck() {
    if (!game || finished || game.won() || !live()) return;
    if (game.stuck()) showStuck();
  }
  // Alle kort er vendt: resten lægges op af sig selv, ét ad gangen (tæller ikke som træk)
  function startAuto() {
    autoRunning = true;
    setNote('Alle kort er vendt. Resten lægges op …', 'ok');
    refresh();
    (function step() {
      autoTimer = setTimeout(function () {
        if (!game) return;
        var r = game.autoStep();
        if (r) sfx('grund', Math.max.apply(null, game.state.f));
        refresh();
        if (!r || r.won) { autoRunning = false; if (game.won()) wonNow(); else refresh(); return; }
        step();
      }, animationOn() ? 170 : 90);
    })();
  }

  // Klik på et kort eller en plads (mus, tryk, dwell og tastatur ender alle her)
  function pickCard(k) {
    if (!live()) return;
    var at = locate(k);
    if (!at) return;
    if (at.k === 'stock') { drawStock(); return; }
    // Er der valgt et kort, og er dette kort et lovligt mål?
    if (sel) {
      var dest = at.k === 't' ? { k: 't', col: at.col } : at.k === 'f' ? { k: 'f' } : null;
      var isSame = (at.k === 't' && sel.src.k === 't' && at.col === sel.src.col && at.idx === sel.src.idx) ||
        (at.k === 'w' && sel.src.k === 'w') || (at.k === 'f' && sel.src.k === 'f' && at.s === sel.src.s);
      if (isSame) {
        if (sel.targets.length === 1) { moveTo(sel.targets[0]); return; }
        cancelSel();
        return;
      }
      var t = dest && findTarget(dest);
      if (t && (t.k !== 'f' || at.top)) { moveTo(t); return; }
      if (dest && dest.k === 't' && at.k === 't' && sel.src.k === 't' && at.col === sel.src.col && !at.up) { cancelSel(); return; }
    }
    if (at.k === 't') {
      if (!at.up) { setNote('Kortet ligger med bagsiden op. Det vendes, når kortene ovenpå er flyttet.', ''); sel = null; refresh(); return; }
      selectSrc({ k: 't', col: at.col, idx: at.idx });
    } else if (at.k === 'w') {
      if (!at.top) return;
      selectSrc({ k: 'w' });
    } else if (at.k === 'f') {
      if (!at.top) return;
      selectSrc({ k: 'f', s: at.s });
    }
  }
  function pickSlot(name) {
    if (!live()) return;
    if (name === 'bunke') { drawStock(); return; }
    if (!sel) return;
    var dest = name.charAt(0) === 'g' ? { k: 'f' } : { k: 't', col: +name.slice(1) };
    var t = findTarget(dest);
    if (t && (dest.k === 't' || t.s === +name.slice(1))) moveTo(t);
    else cancelSel();
  }
  function drawStock() {
    if (!live()) return;
    sel = null;
    var s = game.state;
    if (!s.talon.length) { setNote('Bunken er tom.', ''); refresh(); return; }
    doMove({ k: 'draw' });
  }
  // "+N": de åbne kort, der er samlet under ét i en lang bunke. Et klik vælger det nederste af
  // dem, der kan flyttes (typisk hele rækken fra kongen), ellers det nederste.
  function pickCollapsed(col, n) {
    if (!live()) return;
    var p = game.state.t[col], best = -1;
    for (var i = p.d; i <= Math.min(p.c.length - 1, p.d + n); i++) {
      if (game.targets({ k: 't', col: col, idx: i }).length) { best = i; break; }
    }
    if (best < 0) best = p.d;
    if (p.c[best] !== undefined) pickCard(p.c[best]);
  }
  boardEl.addEventListener('click', function (e) {
    var pt = e.target.closest('.plus-tal');
    if (pt) { pickCollapsed(+pt.dataset.col, +pt.dataset.n); return; }
    var c = e.target.closest('.kort');
    if (c) { pickCard(+c.dataset.k); return; }
    var p = e.target.closest('.plads');
    if (p) pickSlot(p.dataset.slot);
  });

  // ---------- Knapper ----------
  function undo() {
    if (!live() && !(game && !$('#stuck-overlay').hidden)) return;
    if (!game.canUndo()) { setNote('Der er intet at fortryde endnu.', ''); refresh(); return; }
    $('#stuck-overlay').hidden = true;
    game.undo();
    sel = null; hintMv = null;
    sfx('fortryd');
    setNote('Sidste træk er fortrudt (−' + pointsText(-L.POINT.fortryd) + ').', '');
    fresh = false;
    refresh();
    guardBoard();
  }
  function showHint() {
    if (!live()) return;
    sel = null;
    var h = game.hint();
    if (!h) { setNote('Jeg kan ikke finde et godt træk.', ''); refresh(); return; }
    sfx('hint');
    hintMv = h;
    var s = game.state;
    if (h.k === 'draw') setNote(s.talon.length - s.w > 0 ? 'Hint: træk fra bunken.' : 'Hint: vend bunken om.', 'tipnote');
    else {
      var cards = hintCards(h), t = hintDest(h);
      setNote('Hint: ' + cardText(cards[0]) + ' til ' + (t.k === 'f' ? 'grundbunken' : 'bunke ' + (t.col + 1)) + '.', 'tipnote');
    }
    refresh();
  }
  function hintCards(h) {
    var s = game.state;
    if (!h || h.k === 'draw') return [];
    if (h.k === 'tt') return s.t[h.from].c.slice(s.t[h.from].c.length - h.n);
    if (h.k === 'tf') return [s.t[h.from].c[s.t[h.from].c.length - 1]];
    if (h.k === 'wt' || h.k === 'wf') return [s.talon[s.w - 1]];
    if (h.k === 'ft') return [L.kort(h.s, s.f[h.s] - 1)];
    return [];
  }
  function hintDest(h) {
    if (!h) return null;
    if (h.k === 'draw') return { k: 'bunke' };
    if (h.k === 'tf' || h.k === 'wf') { var c = hintCards(h)[0]; return { k: 'f', s: L.suit(c) }; }
    return { k: 't', col: h.to };
  }
  function collect() {
    if (!live()) return;
    sel = null;
    var r = game.collect();
    if (!r.ok) { setNote('Der er ingen kort, der kan lægges op lige nu.', ''); sfx('nej'); refresh(); return; }
    sfx('grund', Math.max.apply(null, game.state.f));
    setNote((r.n === 1 ? '1 kort lagt op' : r.n + ' kort lagt op') + ' · +' + pointsText(r.pts), 'ok');
    afterMove();
  }
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-hint').addEventListener('click', showHint);
  $('#btn-saml').addEventListener('click', collect);
  $('#btn-opgiv').addEventListener('click', function () { sfx('klik'); askQuit('game'); });

  // ---------- Tegning ----------
  function movableMap() {
    var m = {}, s = game.state;
    for (var c = 0; c < 7; c++) {
      var p = s.t[c];
      for (var i = p.d; i < p.c.length; i++) if (L.targetsFor(s, { k: 't', col: c, idx: i }).length) m[p.c[i]] = true;
    }
    return m;
  }
  var geo = null;
  function renderBoard() {
    if (!game || !geo || !tegn.ready) return;
    tegn.render(game.state, {
      sel: sel ? { cards: sel.cards } : null,
      targets: sel ? sel.targets : [],
      hint: hintMv ? { cards: hintCards(hintMv), dest: hintDest(hintMv) } : null,
      movable: movableMap(),
      live: live(),
      fresh: fresh || !animationOn()
    }, geo);
    if (gazeGuard && (gazeGuard.classList.contains('kort') || gazeGuard.classList.contains('plads'))) gazeGuard.setAttribute('data-no-dwell', '');
    applyBoardGuard();
  }
  function defaultHint() {
    if (waiting) return 'Blander kortene …';
    if (!game) return '';
    if (sel) return 'Vælg hvor kortet skal hen';
    return 'Vælg et kort';
  }
  function refresh() {
    var isLive = live();
    $('#hud-score').textContent = series ? series.total() : 0;
    $('#hud-game').textContent = series ? 'Spil ' + Math.max(1, series.games + (waiting ? 1 : 0)) + (series.wins ? ' · ' + series.wins + ' vundet' : '') : '';
    var hint = $('#hint'), cls = noteCls, txt = lastNote || defaultHint();
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    $('#btn-undo').disabled = !isLive || !game || !game.canUndo();
    $('#btn-hint').disabled = !isLive;
    $('#btn-saml').disabled = !isLive;
    $('#btn-opgiv').disabled = !game || finished;
    $('#btn-pause').disabled = !game || finished || waiting;
    if (game) boardEl.setAttribute('aria-label', 'Kabalen, spil ' + series.games + ', ' + modeName(series.draw));
    renderBoard();
  }

  // ---------- Spillet er vundet ----------
  function wonNow() {
    clearTimeout(autoTimer); autoRunning = false;
    sel = null; hintMv = null;
    var rec = series.winGame();
    if (!rec) return;
    sfx('sejr');
    setNote('Spillet er vundet!', 'ok');
    refresh();
    clearTimeout(doneTimer);
    doneTimer = setTimeout(function () { showDone(rec); }, animationOn() ? 700 : 400);
    prepare(series.draw);
  }
  function showDone(rec) {
    if (!series || finished) return;
    $('#done-kicker').textContent = modeName(series.draw);
    $('#done-title').textContent = 'Spil ' + series.games + ' vundet';
    $('#done-points').textContent = '+' + pointsText(rec.score);
    var parts = [pointsText(rec.kort) + ' for kortene', rec.bonus.sejr + ' i sejrsbonus'];
    if (rec.bonus.faaTraek) parts.push(rec.bonus.faaTraek + ' for få træk (' + rec.moves + ' træk)');
    $('#done-parts').textContent = parts.join(' · ') + '. Serien har nu ' + pointsText(series.total()) + '.';
    $('#btn-next-sub').textContent = 'Spil ' + (series.games + 1);
    $('#done-overlay').hidden = false;
    fitScreen($('#done-overlay'));
    dwell.reset();
    guardUnderGaze($('#done-overlay'));
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextGame() {
    if (!series || finished || (game && !game.won())) return;
    $('#done-overlay').hidden = true;
    sfx('klik');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    beginNext(false);
  }
  $('#btn-next').addEventListener('click', nextGame);
  $('#btn-done-quit').addEventListener('click', function () { sfx('klik'); releaseGuard(); finish('stop'); });

  // ---------- Sidder fast ----------
  function showStuck() {
    sel = null; hintMv = null;
    sfx('slut');
    $('#stuck-text').textContent = 'Der er ingen træk, der kan bringe spillet videre. Du kan fortryde og prøve en anden vej, eller slutte serien med ' + pointsText(series.total()) + '.';
    $('#btn-stuck-undo').disabled = !game.canUndo();
    var ov = $('#stuck-overlay');
    ov.hidden = false;
    refresh();
    fitScreen(ov);
    dwell.reset();
    guardUnderGaze(ov);
    $('#btn-stuck-undo').focus({ preventScroll: true });
  }
  $('#btn-stuck-undo').addEventListener('click', function () { $('#stuck-overlay').hidden = true; releaseGuard(); undo(); });
  $('#btn-stuck-end').addEventListener('click', function () { sfx('klik'); releaseGuard(); finish('fast'); });

  // ---------- Pause ----------
  function setPaused(p) {
    if (!game || finished || waiting) return;
    if (p && overlayOpen()) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) { sel = null; fitScreen($('#pause-overlay')); }
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('klik'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('klik'); askQuit('pause'); });

  // ---------- Bekræft Giv op ----------
  var confirmFrom = null;
  function askQuit(from) {
    if (!series || finished) return;
    confirmFrom = from;
    sel = null;
    $('#pause-overlay').hidden = true;
    $('#confirm-text').textContent = 'Serien har ' + pointsText(series.total()) + ' og ' + winsText(series.wins) + '. Pointene gemmes i rekorderne.';
    var ov = $('#confirm-overlay');
    ov.hidden = false;
    refresh();
    fitScreen(ov);
    dwell.reset();
    guardUnderGaze(ov);
    $('#btn-confirm-no').focus({ preventScroll: true });
  }
  function cancelQuit() {
    if (!confirmOpen()) return;
    $('#confirm-overlay').hidden = true;
    releaseGuard();
    dwell.reset();
    sfx('klik');
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('klik'); releaseGuard(); finish('opgivet'); });
  function quitToMenu() { series = null; game = null; paused = false; clearTimers(); hideOverlays(); show('menu'); }
  function clearTimers() { clearTimeout(doneTimer); clearTimeout(autoTimer); clearTimeout(stuckTimer); autoRunning = false; }

  // ---------- Slut ----------
  var lastEntryId = null;
  function saveRecord(why) {
    var out = series.end(why), res = null;
    finished = true;
    if (out && out.score > 0) res = records.add(cat(series.draw), out.score, { levels: out.wins });
    return { out: out, res: res };
  }
  var WHY = {
    opgivet: 'Du gav op i spil ',
    stop: 'Du stoppede efter spil ',
    fast: 'Der var ingen flere træk i spil '
  };
  function finish(why) {
    if (finished || !series) return;
    clearTimers();
    var sv = saveRecord(why), res = sv.res, out = sv.out, rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('rekord'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    if (!res || res.rank !== 1) sfx('slut');
    paused = false; hideOverlays();
    $('#go-title').textContent = 'Serien er slut';
    $('#go-reason').textContent = modeName(series.draw) + ': ' + (WHY[why] || 'Serien sluttede i spil ') + series.games + '.';
    $('#go-score').textContent = out.score;
    $('#go-levels').textContent = winsText(out.wins);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = modeName(series.draw);
    $('#go-records-title').textContent = 'Rekorder – ' + modeName(series.draw);
    renderRecordList($('#go-records'), cat(series.draw), lastEntryId);
    show('gameover');
  }
  window.addEventListener('pagehide', function () { if (series && !finished && (series.total() > 0)) saveRecord('lukket'); });
  $('#btn-again').addEventListener('click', function () { sfx('klik'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('klik'); quitToMenu(); });

  function renderRecordList(ol, c, highlightId) {
    var list = records.list(c);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(e.score + ' point'));
        var lv = document.createElement('span'); lv.className = 'plates';
        lv.textContent = ' · ' + winsText(typeof e.levels === 'number' ? e.levels : 0);
        sc.appendChild(lv);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder ----------
  var recMode = 1;
  function openRecords(d) { recMode = d; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.recMode === recMode)); });
    $('#rec-title').textContent = 'Rekorder – ' + modeName(recMode);
    renderRecordList($('#rec-list'), cat(recMode), null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-mode]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('klik'); recMode = +b.dataset.recMode; syncRecords(); });
  });
  $('#btn-records-back').addEventListener('click', function () { sfx('klik'); show('menu'); });

  // ---------- Indstillinger ----------
  var settingsTab = 'styring';
  function openSettings(from) { settingsReturn = from; syncSettingsUi(); show('settings'); }
  function fmtSeconds(v) { return v.toFixed(v * 10 % 1 === 0 ? 1 : 2).replace('.', ',') + ' sek.'; }
  function syncSettingsUi() {
    $$('#settings [data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === settingsTab)); b.setAttribute('aria-selected', String(b.dataset.tab === settingsTab)); });
    $$('#settings [data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== settingsTab; });
    $$('#settings [data-set]').forEach(function (b) {
      var key = b.dataset.set, cur = arkade.get(key), val = b.dataset.value;
      var match = typeof cur === 'boolean' ? String(cur) === val : cur === val;
      b.setAttribute('aria-pressed', String(match));
    });
    $$('#settings [data-kset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(kset.get(b.dataset.kset)) === b.dataset.value));
    });
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
  }
  $$('#settings [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('klik'); settingsTab = b.dataset.tab; syncSettingsUi(); fitScreen($('#settings'), true); });
  });
  $$('#settings [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, val = b.dataset.value;
      arkade.set(key, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('klik');
      syncSettingsUi();
    });
  });
  $$('#settings [data-kset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.kset, val = b.dataset.value;
      kset.set(key, key === 'draw' ? +val : val === 'true');
      sfx('klik'); syncSettingsUi();
    });
  });
  function stepDwell(delta) {
    var v = Math.round((arkade.get('dwellTime') + delta) * 100) / 100;
    v = Math.min(3, Math.max(0.5, v));
    arkade.set('dwellTime', v);
    sfx('klik');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('klik');
    if (settingsReturn === 'game' && game && !finished) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // 1–7 vælger det øverste kort, man kan flytte, i en bunke (eller bunken som mål),
  // G grundbunken som mål, V det vendte kort, mellemrum/T trækker fra bunken,
  // U/Z fortryder, H hint, S saml, Esc fortryder valget eller giver pause.
  function keyColumn(c) {
    if (!live()) return;
    var s = game.state, p = s.t[c];
    if (sel) {
      var t = findTarget({ k: 't', col: c });
      if (t) { moveTo(t); return; }
      if (sel.src.k === 't' && sel.src.col === c) {
        // Samme bunke igen: et kort længere nede (flere kort med), eller fortryd valget
        var idx = sel.src.idx - 1;
        if (idx >= p.d) { selectSrc({ k: 't', col: c, idx: idx }); return; }
        cancelSel(); return;
      }
    }
    if (!p.c.length) { setNote('Bunke ' + (c + 1) + ' er tom.', ''); sel = null; refresh(); return; }
    selectSrc({ k: 't', col: c, idx: p.c.length - 1 });
  }
  function keyFoundation() {
    if (!live()) return;
    if (sel) { var t = findTarget({ k: 'f' }); if (t) { moveTo(t); return; } setNote('Kortet kan ikke lægges på grundbunken.', 'err'); sfx('nej'); refresh(); return; }
    collect();
  }
  function keyWaste() {
    if (!live()) return;
    if (game.state.w > 0) { if (sel && sel.src.k === 'w') { pickCard(game.state.talon[game.state.w - 1]); return; } selectSrc({ k: 'w' }); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; }
    if (e.key === 'Escape' && sel) { e.preventDefault(); cancelSel(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (e.repeat) handled = /^[1-7]$/.test(k) || k === ' ';
    else if (/^[1-7]$/.test(k)) keyColumn(+k - 1);
    else if (k === 'g' || k === 'f') keyFoundation();
    else if (k === 'v' || k === 'w') keyWaste();
    else if (k === ' ' || k === 't' || k === 'd') drawStock();
    else if (k === 'u' || k === 'z' || k === 'Backspace') undo();
    else if (k === 'h') showHint();
    else if (k === 's') collect();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && !document.activeElement.classList.contains('kort')) document.activeElement.blur();
  });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er ca. 3 cm, når der er plads, ellers så store som muligt, men aldrig under
  // MIN_T (84 px). Kortene er mindst MIN_T brede. Layoutet med de største kort vælges.
  var MIN_T = 84, NCELL = 6; // 5 knapper + pointfeltet
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, Math.round(mn * 0.014)), g: Math.max(8, Math.min(24, Math.round(mn * 0.02))) }; }

  // Kortenes mål i et område (BW × BH). mode 'syv': 7 kolonner med bunke, vendte kort og
  // grundbunker øverst. mode 'fire': 4 kolonner (smal skærm på højkant).
  function cardGeo(mode, BW, BH, draw) {
    var best = null;
    var cols = mode === 'syv' ? 7 : 4;
    var gx = Math.max(6, Math.min(18, Math.round(BW * 0.012)));
    var maxCw = Math.floor((BW - (cols - 1) * gx) / cols);
    if (maxCw < MIN_T) return null;
    maxCw = Math.min(maxCw, 210);
    var list = [];
    for (var c = maxCw; c > MIN_T; c = Math.floor(c * 0.97)) list.push(c);
    list.push(MIN_T);
    for (var li = 0; li < list.length; li++) {
      var cw = list[li];
      for (var kr = 1.4; kr >= 1.0 - 1e-9; kr -= 0.1) {
        var ch = Math.round(cw * kr);
        var g = base(cw, ch, gx);
        var o = mode === 'syv' ? fitSyv(g, BW, BH) : fitFire(g, BW, BH);
        if (!o) continue;
        o.score = cw + Math.min(o.strips, 6) * 14 + (kr - 1) * 120;
        if (!best || o.score > best.score) best = o;
      }
      if (best && best.strips >= 5) break;
    }
    return best;
  }
  function base(cw, ch, gx) {
    var big = Math.max(MIN_T, Math.round(ch * 0.3));
    return {
      cw: cw, ch: ch, gx: gx, gy: gx,
      big: big, thin: Math.max(22, Math.round(cw * 0.17)),
      down: Math.max(7, Math.min(16, Math.round(ch * 0.07))),
      badge: Math.max(28, Math.min(38, Math.round(cw * 0.2))),
      idx: Math.max(18, Math.min(44, Math.round(Math.min(cw * 0.3, big * 0.5)))),
      idxThin: 0
    };
  }
  function finish3(g) { g.idxThin = Math.max(13, Math.round(Math.min(g.idx * 0.75, g.thin * 0.72))); return g; }
  function fitSyv(g, BW, BH) {
    var opts = [g.ch, Math.max(MIN_T, Math.round(g.ch * 0.72))];
    for (var i = 0; i < opts.length; i++) {
      var rh = opts[i], TH = BH - rh - g.gy;
      var strips = Math.floor((TH - g.ch - g.badge) / g.big);
      if (TH < g.ch + g.badge + g.thin) continue;
      if (strips < 3 && i === 0) continue;
      var W = 7 * g.cw + 6 * g.gx, o = Object.assign({}, g, { mode: 'syv', W: W, H: BH, strips: strips, rh: rh });
      var x = function (c) { return c * (g.cw + g.gx); };
      var fan = Math.max(18, Math.min(Math.round(g.cw * 0.42), Math.floor((x(3) - x(1) - g.cw - 4) / 2)));
      o.slots = {
        stock: { x: x(0), y: 0, w: g.cw, h: rh },
        waste: { x: x(1), y: 0, w: g.cw, h: rh, fan: fan },
        f: [0, 1, 2, 3].map(function (s) { return { x: x(3 + s), y: 0, w: g.cw, h: rh }; }),
        t: [0, 1, 2, 3, 4, 5, 6].map(function (c) { return { x: x(c), y: rh + g.gy, w: g.cw, h: TH }; })
      };
      return finish3(o);
    }
    return null;
  }
  function fitFire(g, BW, BH) {
    // Række 1: grundbunker. Bånd A: bunke 1–4. Bånd B: bunke 5–7 + bunken og de vendte kort.
    var rh = Math.max(MIN_T, Math.min(g.ch, Math.round(g.ch * 0.8)));
    var band = Math.floor((BH - rh - 2 * g.gy) / 2);
    if (band < g.ch + g.badge + g.thin || (band - g.gy) / 2 < MIN_T) return null;
    var strips = Math.floor((band - g.ch - g.badge) / g.big);
    var W = 4 * g.cw + 3 * g.gx, o = Object.assign({}, g, { mode: 'fire', W: W, H: BH, strips: strips, rh: rh });
    var x = function (c) { return c * (g.cw + g.gx); };
    var yA = rh + g.gy, yB = yA + band + g.gy, half = Math.floor((band - g.gy) / 2);
    o.slots = {
      f: [0, 1, 2, 3].map(function (s) { return { x: x(s), y: 0, w: g.cw, h: rh }; }),
      t: [0, 1, 2, 3, 4, 5, 6].map(function (c) { return c < 4 ? { x: x(c), y: yA, w: g.cw, h: band } : { x: x(c - 4), y: yB, w: g.cw, h: band }; }),
      stock: { x: x(3), y: yB, w: g.cw, h: Math.min(half, g.ch) },
      waste: { x: x(3), y: yB + half + g.gy, w: g.cw, h: Math.min(half, g.ch), fan: 0 }
    };
    return finish3(o);
  }
  // Panelet: pointfelt + 5 knapper i k kolonner, og en hjælpelinje over dem.
  function panelSize(k, b, ig, hintH) {
    var rows = Math.ceil(NCELL / k);
    return { k: k, rows: rows, w: Math.max(k === 1 ? 172 : 0, k * b + (k - 1) * ig), h: hintH + ig + rows * b + (rows - 1) * ig };
  }
  function bestLayout(v, draw) {
    var sp = spacing(v.W, v.H), p = sp.p, g = sp.g;
    var small = Math.min(v.W, v.H) < 560, ig = small ? 8 : 10;
    var b0 = Math.max(MIN_T, cssBtn(v.W, v.H)), best = null;
    for (var b = b0; ; b = Math.max(MIN_T, b * 0.93)) {
      var bb = Math.floor(b);
      [1, 2].forEach(function (k) {
        var hintH = k === 1 ? (small ? 96 : 118) : (small ? 64 : 76);
        var pn = panelSize(k, bb, ig, hintH);
        if (pn.h > v.H - 2 * p) return;
        var BW = v.W - 2 * p - g - pn.w, BH = v.H - 2 * p;
        consider('side', pn, BW, BH, bb, hintH);
      });
      [6, 3, 2].forEach(function (k) {
        var hintH = small ? 44 : 56;
        var pn = panelSize(k, bb, ig, hintH);
        if (pn.w > v.W - 2 * p) return;
        var BW = v.W - 2 * p, BH = v.H - 2 * p - g - pn.h;
        consider('below', pn, BW, BH, bb, hintH);
      });
      if (bb <= MIN_T) break;
    }
    function consider(lay, pn, BW, BH, bb, hintH) {
      ['syv', 'fire'].forEach(function (mode) {
        if (mode === 'fire' && v.W > v.H) return;
        var cg = cardGeo(mode, BW, BH, draw);
        if (!cg) return;
        var sc = Math.min(cg.cw, 190) + Math.min(cg.strips, 6) * 12 - Math.max(0, 3 - cg.strips) * 40 + 0.35 * bb + (mode === 'syv' ? 30 : 0);
        if (!best || sc > best.score) best = { score: sc, lay: lay, pn: pn, b: bb, geo: cg, BW: BW, BH: BH, p: p, g: g, ig: ig, hintH: hintH };
      });
    }
    return best;
  }
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function layoutGame() {
    if (current !== 'game') return;
    var v = viewport(), fit = bestLayout(v, series ? series.draw : 1);
    if (!fit) return;
    var st = gameEl.style, pn = fit.pn, cg = fit.geo;
    st.setProperty('--btn', fit.b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, fit.b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--ig', fit.ig + 'px');
    st.setProperty('--tools-cols', pn.k);
    st.setProperty('--hint-h', fit.hintH + 'px');
    gameEl.dataset.layout = fit.lay;
    gameEl.dataset.mode = cg.mode;
    // Pladen centreres i sit område; panelet står ved siden af eller nedenunder
    var bx, by, sx, sy, sw, sh;
    if (fit.lay === 'side') {
      var used = cg.W + fit.g + pn.w, left = Math.max(fit.p, Math.floor((v.W - used) / 2));
      bx = left; by = fit.p + Math.max(0, Math.floor((fit.BH - cg.H) / 2));
      sx = left + cg.W + fit.g; sw = pn.w; sh = pn.h; sy = Math.max(fit.p, Math.floor((v.H - pn.h) / 2));
    } else {
      var usedH = cg.H + fit.g + pn.h, top = Math.max(fit.p, Math.floor((v.H - usedH) / 2));
      bx = Math.max(fit.p, Math.floor((v.W - cg.W) / 2)); by = top;
      sw = Math.max(pn.w, Math.min(cg.W, v.W - 2 * fit.p)); sx = Math.floor((v.W - sw) / 2); sy = top + cg.H + fit.g; sh = pn.h;
    }
    place(boardEl, bx, by, cg.W, cg.H);
    place(sideEl, sx, sy, sw, sh);
    geo = cg;
    fresh = true;
    renderBoard();
    fresh = false;
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }
  function place(el, x, y, w, h) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }

  // ---------- Små skærme ----------
  var SMALL_MIN = MIN_T, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('ka-lille', small);
    root.classList.toggle('ka-tvaers', small && v.W > v.H);
  }

  // Sider: blokkene (data-trin) fordeles på så få sider, som der er plads til.
  function makePager(screen, opts) {
    var nav = document.createElement('div');
    nav.className = 'trin-nav';
    nav.hidden = true;
    nav.innerHTML = '<button class="btn trin-prev" aria-label="Forrige side"><span class="icon" aria-hidden="true">‹</span><span class="big">Forrige</span></button>' +
      '<span class="trin-label" aria-live="polite"></span>' +
      '<button class="btn trin-next" aria-label="Næste side"><span class="icon" aria-hidden="true">›</span><span class="big">Næste</span></button>';
    opts.navIn.appendChild(nav);
    function placeNav() {
      var host = (opts.navBottom && !root.classList.contains('ka-tvaers')) ? opts.navBottom : opts.navIn;
      if (nav.parentNode !== host) host.appendChild(nav);
      if (opts.navBottom) opts.navBottom.hidden = host !== opts.navBottom || nav.hidden;
    }
    var prev = nav.querySelector('.trin-prev'), next = nav.querySelector('.trin-next'), label = nav.querySelector('.trin-label');
    var pages = [], idx = 0;
    function setHidden(el, h) { el.classList.toggle('trin-skjult', h); }
    function showPage(i, moveFocus) {
      idx = Math.max(0, Math.min(pages.length - 1, i));
      pages.forEach(function (pg, k) { pg.forEach(function (el) { setHidden(el, k !== idx); }); });
      label.textContent = 'Side ' + (idx + 1) + ' af ' + pages.length;
      prev.disabled = idx === 0;
      next.disabled = idx === pages.length - 1;
      if (moveFocus) {
        var a = document.activeElement;
        if (a === prev && prev.disabled) next.focus({ preventScroll: true });
        else if (a === next && next.disabled) prev.focus({ preventScroll: true });
      }
    }
    prev.addEventListener('click', function () { sfx('klik'); showPage(idx - 1, true); });
    next.addEventListener('click', function () { sfx('klik'); showPage(idx + 1, true); });
    return {
      reset: function () {
        opts.all().forEach(function (el) { setHidden(el, false); });
        nav.hidden = true; pages = [];
        placeNav();
      },
      paginate: function (keep) {
        var blocks = opts.blocks(), was = keep ? idx : 0;
        nav.hidden = false;
        placeNav();
        label.textContent = 'Side 1 af 2';
        blocks.forEach(function (el) { setHidden(el, true); });
        pages = [];
        var cur = [];
        blocks.forEach(function (el) {
          setHidden(el, false);
          if (cur.length && overflows(screen)) {
            setHidden(el, true);
            cur.forEach(function (c) { setHidden(c, true); });
            pages.push(cur);
            cur = [el];
            setHidden(el, false);
          } else cur.push(el);
        });
        if (cur.length) pages.push(cur);
        if (pages.length < 2) { this.reset(); return; }
        showPage(was);
      },
      get pages() { return pages.length; },
      get index() { return idx; },
      go: function (i) { showPage(i, true); }
    };
  }
  var pagers = {
    settings: makePager($('#settings'), {
      navIn: $('#settings .tabs'),
      navBottom: $('#settings .trin-bund'),
      all: function () { return $$('#settings .tab-panel > *'); },
      blocks: function () { return $$('#settings .tab-panel:not([hidden]) > *'); }
    }),
    om: makePager($('#om'), {
      navIn: $('#om .om-back-row'),
      all: function () { return $$('#om [data-trin]'); },
      blocks: function () { return $$('#om [data-trin]'); }
    })
  };

  // Game over på en lille skærm: resultatet og rekordlisten på hver sin side.
  var goEl = $('#gameover'), goShowRecords = false;
  function setGoSplit(on) {
    goEl.classList.toggle('go-split', on);
    $('#btn-go-rec').hidden = !on;
    goEl.classList.toggle('go-vis-rekorder', on && goShowRecords);
    $('#go-rec-label').textContent = goShowRecords ? 'Resultat' : 'Rekorder';
    $('#go-rec-icon').textContent = goShowRecords ? '←' : '★';
  }
  $('#btn-go-rec').addEventListener('click', function () {
    sfx('klik');
    goShowRecords = !goShowRecords;
    setGoSplit(true);
    fitScreen(goEl);
    $('#btn-go-rec').focus({ preventScroll: true });
  });

  // De andre skærme (og boksene) tilpasses vinduet, til alt kan ses:
  // 1) mindre knapper og afstande (aldrig under SMALL_MIN på små skærme),
  // 2) valgfri tekst skjules, 3) indholdet deles på flere sider, 4) zoom som nødløsning.
  function fitScreen(el, resetPage) {
    if (!el || el.hidden) return;
    var v = viewport(), small = isSmall(v), gap = cssGap(v.W, v.H);
    var isOverlay = el.classList.contains('overlay');
    var target = isOverlay ? el.querySelector('.panel') : el;
    var box = el, pager = pagers[el.id];
    target.style.zoom = '';
    el.style.removeProperty('--btn'); el.style.removeProperty('--gap');
    el.classList.remove('tight');
    if (el.id === 'menu') el.classList.remove('hall-inflow');
    var keepPage = !resetPage && pager && pager.pages > 1;
    if (pager) pager.reset();
    if (el === goEl) { if (resetPage) goShowRecords = false; setGoSplit(false); }
    var base = cssBtn(v.W, v.H);
    var minB = small ? SMALL_MIN : MIN_T;
    if (isOverlay) el.style.setProperty('--btn', base + 'px');
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('ka-tvaers')) {
        var h = $('#btn-hall').getBoundingClientRect(), t = $('.title-block').getBoundingClientRect();
        if (!el.classList.contains('hall-inflow') && h.right > t.left && h.bottom > t.top && h.left < t.right && h.top < t.bottom) {
          el.classList.add('hall-inflow');
          return false;
        }
      }
      return true;
    };
    if (fits()) return;
    var b = base;
    for (var i = 0; i < 12 && !fits() && b > minB; i++) {
      b = Math.max(minB, b * 0.92);
      el.style.setProperty('--btn', b + 'px');
      el.style.setProperty('--gap', Math.max(10, gap * b / base) + 'px');
    }
    if (!fits()) el.classList.add('tight');
    if (!fits() && el === goEl) setGoSplit(true);
    if (!fits() && pager) pager.paginate(keepPage);
    var z = 1;
    for (var j = 0; j < 10 && !fits(); j++) {
      var r = Math.min(box.clientHeight / box.scrollHeight, box.clientWidth / box.scrollWidth, 0.97);
      z = Math.max(0.3, z * r);
      target.style.zoom = String(z);
    }
  }
  function fitCurrent() {
    if (current === 'game') layoutGame(); else fitScreen($('#' + current));
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    syncSmall();
    if (current === 'menu') syncMenu();
    fitCurrent();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitCurrent, 150);
  });

  // ---------- Start ----------
  KabaleTegn.installerGrafik();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Kabalen = {
    get series() { return series; }, get game() { return game; }, get sel() { return sel; }, get geo() { return geo; },
    get waiting() { return waiting; }, get hint() { return hintMv; }, get deal() { return lastDealInfo; },
    get guard() { return gazeGuard ? (gazeGuard.id || gazeGuard.className) : null; },
    settings: arkade, gameSettings: kset, records: records, dwell: dwell, audio: audio, lyd: lyd,
    start: startGame, show: show, pickCard: pickCard, pickSlot: pickSlot, draw: drawStock, undo: undo, showHint: showHint,
    collect: collect, askQuit: askQuit, cancelQuit: cancelQuit, next: nextGame, finish: finish, refresh: refresh,
    setPaused: setPaused, layout: layoutGame, showStuck: showStuck, live: live,
    // Test: spil et træk som spilleren (træk med p = klik på bunken, til w = p)
    play: function (m) {
      if (!live()) return false;
      if (m.p !== undefined) { var n = 0; while (game.state.w !== m.p && n++ < 100) doMove({ k: 'draw' }); m = Object.assign({}, m); delete m.p; }
      doMove(m); return true;
    },
    // Test: læg et bestemt spil (fx næsten vundet) i serien
    loadDeal: function (state) { if (!series) return; game = series.start(state); series.games--; sel = null; hintMv = null; fresh = true; tegn.build(); refresh(); }
  };
})();
