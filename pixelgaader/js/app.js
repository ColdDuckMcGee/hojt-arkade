/*
 * Pixelgåder – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Lys ud, Blokke og Bomberne.
 *
 * Vælg et værktøj (Udfyld, Kryds eller Visk), og vælg så et felt (klik, tryk,
 * dwell eller Enter). Et forkert farvet felt koster et liv. Der er ingen tid.
 * Gåder uden ende – spillet slutter, når man mister alle tre liv i en gåde
 * (eller selv vælger Afslut).
 */
(function () {
  'use strict';
  /* LUFT: mindst 24 px mellem knapper med forskellig betydning – en øjenstyring rammer inden for ca. 20–40 px */
  var LUFT = 24;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.PixelgaaderGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // mode: 'stigende' (5 × 5 og op) eller en fast størrelse.
  // hoverLines: markér svagt rækken og kolonnen (og deres hints), hvor man kigger.
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  var bset = ArkadeSettings.create('pixelgaader', { mode: 'stigende', hoverLines: true, gloed: true });
  var records = ArkadeHighscores.create('pixelgaader', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (G.MODES.indexOf(bset.get('mode')) < 0) bset.set('mode', 'stigende');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = én handling. Dwell-modulet slipper sin lås, hvis en knap bliver
  // deaktiveret et øjeblik. Derfor holder spillet sin egen lås på knapperne
  // (felterne og Tip): samme knap kan først dwelles igen, når
  // blikket har forladt den.
  var gazeLock = null, suppress = null;
  var dwell = ArkadeDwell.create({
    enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000,
    onActivate: function (el) {
      if (!el.classList.contains('turn-btn')) return;
      if (el === gazeLock) suppress = el; else gazeLock = el;
    }
  });
  var lastPX = -1, lastPY = -1;
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') { lastPX = e.clientX; lastPY = e.clientY; }
    if (gazeGuard) releaseGuard(e.clientX, e.clientY);
    if (!gazeLock) return;
    var r = gazeLock.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) gazeLock = null;
  }, { passive: true });
  // Dwell-sikker dialog: når en ny boks åbnes, kan der ligge en knap præcis dér, hvor
  // blikket allerede er. Den knap kan ikke dwelles, før blikket har forladt den én gang.
  var gazeGuard = null;
  function guardUnderGaze(root) {
    releaseGuard();
    if (lastPX < 0) return;
    var el = document.elementFromPoint(lastPX, lastPY);
    var b = el && el.closest('button, a[href]');
    if (b && root.contains(b)) { gazeGuard = b; b.setAttribute('data-no-dwell', ''); }
  }
  function releaseGuard(x, y) {
    if (!gazeGuard) return;
    if (x !== undefined) {
      var r = gazeGuard.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return;
    }
    gazeGuard.removeAttribute('data-no-dwell');
    gazeGuard = null;
  }
  function swallowed(el) { if (suppress === el) { suppress = null; return true; } return false; }

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul (alle rolige). Pixelgåder bruger disse navne:
  var SFX = {
    fill: 'move', cross: 'click', erase: 'bonusGone', error: 'obstacle', line: 'eat', tip: 'bonusSpawn',
    solved: 'bonus', lost: 'crash', record: 'record', click: 'click', pause: 'pause'
  };
  function sfx(name) { audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true); // TD Browse m.fl. kan klikke uden pointerdown
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
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
    $('#game').classList.toggle('calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og bløde skift på felterne. Fra giver faste skift';
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);

  arkade.onChange(function (key, value) {
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') dwell.setEnabled(value);
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') audio.setSfx(value);
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-pg-gloed', bset.get('gloed') ? 'til' : 'fra'); }
  bset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'hoverLines' || key === 'gloed') { syncSettingsUi(); renderBoard(); }
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
  function sizeLabel(id) { return G.SIZES[id] ? G.SIZES[id].label : id; }
  function modeName(m) { return m === 'stigende' ? 'Stigende' : sizeLabel(m); }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function puzzlesText(n) { return n === 1 ? '1 gåde' : n + ' gåder'; }
  function livesText(n) { return n === 1 ? '1 liv' : n + ' liv'; }
  function cmText(px) { return (px / (96 / 2.54)).toFixed(1).replace('.', ','); }

  // ---------- Størrelser, skærmen kan bære ----------
  // Felterne er knapper og skal være store nok til øjenstyring. En størrelse bruges
  // kun, hvis felterne bliver mindst MIN_CELL px (ca. 2 cm). 5 × 5 kan altid vælges.
  var MIN_CELL = 72;
  function availableSizes() {
    return G.SIZE_ORDER.filter(function (s) { return s === '5x5' || cellSizeFor(s) >= MIN_CELL; });
  }
  function maxSize() { var a = availableSizes(); return a[a.length - 1]; }
  function currentMode() {
    var m = bset.get('mode');
    if (m !== 'stigende' && availableSizes().indexOf(m) < 0) return 'stigende';
    return m;
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var avail = availableSizes(), mode = currentMode(), mx = avail[avail.length - 1];
    $$('#menu [data-mode]').forEach(function (b) {
      var m = b.dataset.mode;
      b.hidden = m !== 'stigende' && avail.indexOf(m) < 0;
      b.setAttribute('aria-pressed', String(m === mode));
    });
    $('#mode-stigende-sub').textContent = mx === '5x5' ? 'flere og flere' : '5 × 5 til ' + sizeLabel(mx);
    var notes = [];
    var missing = G.SIZE_ORDER.filter(function (s) { return avail.indexOf(s) < 0; });
    if (missing.length) notes.push((missing.length === 1 ? sizeLabel(missing[0]) + ' kræver' : missing.map(sizeLabel).join(', ').replace(/, ([^,]*)$/, ' og $1') + ' kræver') + ' en større skærm, så felterne bliver store nok.');
    var c5 = cellSizeFor('5x5');
    if (c5 < MIN_CELL) notes.push('På denne skærm bliver felterne ca. ' + cmText(c5) + ' cm.' + (isFullscreen() ? '' : ' Fuld skærm giver lidt større felter.'));
    $('#size-note').textContent = notes.join(' ');
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('mode', b.dataset.mode); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(currentMode()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, bset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) audio.setMusic(arkade.get('music')); // tilbage via browserens tilbage-knap
  });
  $('#btn-om').addEventListener('click', function () { sfx('click'); show('om'); });
  $('#btn-om-back').addEventListener('click', function () { sfx('click'); show('menu'); });

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
    b.addEventListener('click', function () { sfx('click'); toggleFullscreen(); });
  });
  function onFs() { syncFullscreen(); if (current === 'menu') syncMenu(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, finished = false;
  var tool = 'udfyld';
  var hoverIdx = -1, curIdx = -1;   // feltet under blikket/musen og tastaturets markør
  var boardEl = $('#board');
  var lastNote = '', noteCls = '', doneTimer = 0, overTimer = 0;
  var TOOL_NAMES = { udfyld: 'Udfyld', kryds: 'Kryds', visk: 'Visk' };

  // Tegningen af gitteret ligger i js/tegn.js og læser kun spillets tilstand
  var tegn = PixelgaaderTegn.create(boardEl);
  function buildBoard(p) { tegn.build(p); }

  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    if (!c || swallowed(c)) return;
    act(+c.dataset.i);
  });
  // Markering af række og kolonne: kun for mus, pen og øjenstyring (ikke for fingre)
  boardEl.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var c = e.target.closest('.cell');
    var i = c ? +c.dataset.i : -1;
    if (i !== hoverIdx) { hoverIdx = i; renderBoard(); }
  });
  boardEl.addEventListener('pointerleave', function () { if (hoverIdx >= 0) { hoverIdx = -1; renderBoard(); } });

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(currentMode(), { maxSize: maxSize() });
    paused = false; finished = false; tool = 'udfyld';
    hoverIdx = -1; curIdx = -1; lastNote = ''; noteCls = '';
    clearTimeout(doneTimer); clearTimeout(overTimer);
    buildBoard(run.state.puzzle);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !run.state.solved && !run.state.over && current === 'game' && !overlayOpen(); }

  function linesText(lines) {
    if (!lines || !lines.length) return '';
    var rs = lines.filter(function (l) { return l[0] === 'r'; }).map(function (l) { return +l.slice(1) + 1; });
    var cs = lines.filter(function (l) { return l[0] === 'c'; }).map(function (l) { return +l.slice(1) + 1; });
    var parts = [];
    if (rs.length) parts.push((rs.length === 1 ? 'Række ' : 'Række ') + rs.join(' og '));
    if (cs.length) parts.push((parts.length ? 'kolonne ' : 'Kolonne ') + cs.join(' og '));
    return parts.join(' og ') + ' er løst';
  }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }
  function act(i, useTool) {
    if (!live()) return;
    var t = useTool || tool;
    var res = run.apply(t, i);
    if (curIdx >= 0) curIdx = i;
    if (!res.ok) {
      var msg = {
        'krydset': 'Feltet er krydset. Vælg Visk for at fjerne krydset først.',
        'låst': run.state.lock[i] === 'fejl' ? 'Feltet er tomt i billedet.' : run.state.lock[i] === 'auto' ? 'Feltet er tomt – rækken eller kolonnen er løst.' : 'Feltet er allerede vist.',
        'farvet': 'Farvede felter er altid rigtige og bliver stående.',
        'tomt': 'Der er intet kryds at viske ud her.',
        'allerede': t === 'kryds' ? 'Feltet er allerede krydset.' : ''
      }[res.result] || '';
      setNote(msg, '');
      refresh();
      return;
    }
    if (res.result === 'fejl') {
      if (res.over) {
        sfx('lost');
        setNote('Feltet var tomt, og du har ikke flere liv.', 'err');
        refresh();
        clearTimeout(overTimer);
        overTimer = setTimeout(function () { finish('lost'); }, animationOn() ? 1600 : 1200);
        return;
      }
      sfx('error');
      setNote('Feltet er tomt i billedet. Du mistede et liv – ' + livesText(run.state.lives) + ' tilbage.', 'err');
      refresh();
      return;
    }
    if (res.solved) {
      sfx('solved');
      setNote('', '');
      refresh();
      clearTimeout(doneTimer);
      doneTimer = setTimeout(showDone, animationOn() ? 900 : 600);
      return;
    }
    if (res.result === 'farvet') {
      var lt = linesText(res.lines);
      sfx(lt ? 'line' : 'fill');
      setNote(lt, lt ? 'ok' : '');
    } else if (res.result === 'krydset') { sfx('cross'); setNote('', ''); }
    else if (res.result === 'visket') { sfx('erase'); setNote('Krydset er fjernet', ''); }
    refresh();
  }
  function showTip() {
    if (!live()) return;
    var i = run.hint();
    if (i < 0) return;
    sfx('tip');
    var y = Math.floor(i / run.n), x = i % run.n;
    if (run.state.solved) {
      refresh(); clearTimeout(doneTimer); doneTimer = setTimeout(showDone, animationOn() ? 900 : 600); return;
    }
    setNote('Tip: række ' + (y + 1) + ', kolonne ' + (x + 1) + ' er farvet (−' + run.hintCost() + ' point)', 'tipnote');
    refresh();
  }
  function setTool(t) {
    if (!TOOL_NAMES[t]) return;
    tool = t;
    setNote('', '');
    refresh();
  }
  $$('#tools [data-tool]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); setTool(b.dataset.tool); });
  });

  // ---------- Tegning ----------
  function picSvg(sol, n) { return PixelgaaderTegn.billede(sol, n); }
  function renderBoard() {
    if (!run || !tegn.ready) return;
    var focus = (live() && bset.get('hoverLines')) ? (hoverIdx >= 0 ? hoverIdx : curIdx) : -1;
    tegn.board(run.state, { focus: focus, cursor: live() ? curIdx : -1 });
  }
  function renderLives() {
    var el = $('#hud-lives');
    tegn.lives(el, run.state.lives, G.RULES.lives);
    el.setAttribute('aria-label', livesText(run.state.lives) + ' tilbage');
  }

  function refresh() {
    if (!run) return;
    var s = run.state, p = s.puzzle;
    if (tegn.builtFor !== p) { buildBoard(p); if (current === 'game') layoutGame(); }
    $('#hud-puzzle').textContent = s.index + 1;
    $('#hud-size').textContent = sizeLabel(p.size);
    $('#hud-score').textContent = s.score;
    renderLives();
    var pts = G.RULES.points[p.n];
    $('#points-note').textContent = 'Fejlfri gåde: +' + (pts.base + pts.perfect) + ' point';
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (s.solved) { txt = 'Billedet er afsløret!'; cls = 'ok'; }
    else if (s.over && !txt) { txt = 'Ingen flere liv'; cls = 'err'; }
    else if (!txt) txt = 'Værktøj: ' + TOOL_NAMES[tool] + ' · vælg et felt';
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    $$('#tools [data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); b.disabled = !live(); });
    $('#btn-tip').disabled = !live();
    $('#tip-sub').textContent = '−' + run.hintCost() + ' point';
    $('#btn-tip').setAttribute('aria-label', 'Tip: afslør et felt (koster ' + run.hintCost() + ' point)');
    boardEl.setAttribute('aria-label', 'Gitter ' + sizeLabel(p.size) + ', gåde ' + (s.index + 1));
    renderBoard();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  $('#btn-tip').classList.add('turn-btn');
  $('#btn-tip').addEventListener('click', function () { if (!swallowed(this)) showTip(); });

  // ---------- Gåde løst ----------
  function showDone() {
    if (!run || !run.state.solved || finished) return;
    var s = run.state, p = s.puzzle, pt = s.lastPoints;
    $('#done-kicker').textContent = 'Gåde ' + (s.index + 1) + ' løst';
    $('#done-title').textContent = p.name;
    $('#done-pic').innerHTML = picSvg(p.sol, p.n);
    $('#done-points').textContent = '+' + pointsText(pt.total);
    var parts = [pt.base + ' for gåden'];
    if (pt.bonus) parts.push(pt.bonus + ' i bonus for fejlfri');
    if (pt.errorCost) parts.push('−' + pt.errorCost + ' for ' + (s.errors === 1 ? '1 fejl' : s.errors + ' fejl'));
    if (pt.hintCost) parts.push('−' + pt.hintCost + ' for ' + (s.hints === 1 ? '1 tip' : s.hints + ' tip'));
    $('#done-parts').textContent = parts.join(' · ') + '. I alt ' + pointsText(s.score) + '.';
    var nextSize = G.sizeForPuzzle(s.mode, s.index + 1, s.maxSize);
    $('#btn-next-sub').textContent = 'Gåde ' + (s.index + 2) + ' · ' + sizeLabel(nextSize);
    $('#done-overlay').hidden = false;
    fitScreen($('#done-overlay'));
    dwell.reset();
    guardUnderGaze($('#done-overlay'));
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextPuzzle() {
    if (!run || !run.state.solved || finished) return;
    run.nextPuzzle();
    $('#done-overlay').hidden = true;
    hoverIdx = -1; curIdx = -1; setNote('', '');
    sfx('click');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-next').addEventListener('click', nextPuzzle);
  $('#btn-done-quit').addEventListener('click', function () { sfx('click'); askQuit('done'); });

  function setPaused(p) {
    if (!run || finished || run.state.solved || run.state.over) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit('pause'); });

  // ---------- Bekræft Afslut ----------
  var confirmFrom = null;
  function askQuit(from) {
    if (!run || finished || run.state.over) return;
    confirmFrom = from;
    $('#pause-overlay').hidden = true;
    $('#done-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' og ' + puzzlesText(s.solvedCount) + ' løst. Pointene gemmes i rekorderne.';
    var ov = $('#confirm-overlay');
    ov.hidden = false;
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
    sfx('click');
    if (confirmFrom === 'done' && run && run.state.solved) { showDone(); return; }
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { run = null; paused = false; clearTimeout(doneTimer); clearTimeout(overTimer); hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  // Rekorder pr. serie (Stigende eller en fast størrelse): point og antal løste gåder.
  var lastEntryId = null;
  function saveRecord() {
    var s = run.state, out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(s.mode, out.score, { levels: out.solved });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimeout(doneTimer); clearTimeout(overTimer);
    var s = run.state, p = s.puzzle, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    var pic = $('#go-pic');
    if (why === 'lost') {
      $('#go-title').textContent = 'Spillet er slut';
      $('#go-reason').textContent = 'Du mistede alle tre liv i gåde ' + (s.index + 1) + '. Billedet var: ' + p.name + '.';
      pic.innerHTML = picSvg(p.sol, p.n);
    } else {
      $('#go-title').textContent = 'Spillet er slut';
      $('#go-reason').textContent = s.solved ? 'Du afsluttede efter gåde ' + (s.index + 1) + '.' : 'Du afsluttede på gåde ' + (s.index + 1) + '.';
      pic.innerHTML = s.solved ? picSvg(p.sol, p.n) : '';
    }
    $('#go-score').textContent = s.score;
    var bits = [puzzlesText(s.solvedCount) + ' løst'];
    if (s.perfectCount) bits.push(s.perfectCount + ' fejlfri');
    $('#go-levels').textContent = bits.join(' · ');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = modeName(s.mode);
    $('#go-records-title').textContent = 'Rekorder – ' + modeName(s.mode);
    renderRecordList($('#go-records'), s.mode, lastEntryId);
    show('gameover');
  }
  // Lukkes siden midt i et spil, gemmes sessionen alligevel
  window.addEventListener('pagehide', function () { if (run && !finished) saveRecord(); });
  $('#btn-again').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('click'); quitToMenu(); });

  function renderRecordList(ol, cat, highlightId) {
    var list = records.list(cat);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(e.score + ' point'));
        var lv = document.createElement('span'); lv.className = 'plates';
        lv.textContent = ' · ' + puzzlesText(typeof e.levels === 'number' ? e.levels : 0);
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
  var recMode = 'stigende';
  function openRecords(m) { recMode = m; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recMode === recMode)); });
    $('#rec-title').textContent = 'Rekorder – ' + modeName(recMode);
    renderRecordList($('#rec-list'), recMode, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-mode]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recMode = b.dataset.recMode; syncRecords(); });
  });
  $('#btn-records-back').addEventListener('click', function () { sfx('click'); show('menu'); });

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
    $$('#settings [data-bset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(bset.get(b.dataset.bset)) === b.dataset.value));
    });
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
  }
  $$('#settings [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); settingsTab = b.dataset.tab; syncSettingsUi(); fitScreen($('#settings'), true); });
  });
  $$('#settings [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, val = b.dataset.value;
      arkade.set(key, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('click');
      syncSettingsUi();
    });
  });
  $$('#settings [data-bset]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set(b.dataset.bset, b.dataset.value === 'true'); sfx('click'); syncSettingsUi(); });
  });
  function stepDwell(delta) {
    var v = Math.round((arkade.get('dwellTime') + delta) * 100) / 100;
    v = Math.min(3, Math.max(0.5, v));
    arkade.set('dwellTime', v);
    sfx('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('click');
    if (settingsReturn === 'game' && run && !finished && !run.state.over) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Piletasterne flytter markøren, Enter eller mellemrum bruger det valgte værktøj,
  // F farver, X krydser, V (eller Delete) visker, 1/2/3 vælger værktøj, T giver et tip,
  // Esc eller P giver pause.
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function centre() { var n = run.n, c = Math.floor(n / 2); return c * n + c; }
  function moveCursor(d) {
    if (!live()) return;
    var n = run.n, i = curIdx;
    if (i < 0) i = hoverIdx >= 0 ? hoverIdx : centre();
    else {
      var x = Math.max(0, Math.min(n - 1, i % n + d[0])), y = Math.max(0, Math.min(n - 1, Math.floor(i / n) + d[1]));
      i = y * n + x;
    }
    curIdx = i; hoverIdx = -1;
    renderBoard();
  }
  function keyAct(t) {
    if (!live()) return;
    if (curIdx < 0) { curIdx = hoverIdx >= 0 ? hoverIdx : centre(); renderBoard(); return; }
    act(curIdx, t);
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) keyAct(); }
    else if (k === 'f') { if (!e.repeat) keyAct('udfyld'); }
    else if (k === 'x') { if (!e.repeat) keyAct('kryds'); }
    else if (k === 'v' || k === 'Delete') { if (!e.repeat) keyAct('visk'); }
    else if (k === '1') setTool('udfyld');
    else if (k === '2') setTool('kryds');
    else if (k === '3') setTool('visk');
    else if (k === 't') { if (!e.repeat) showTip(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapper og felter er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver de største felter, og knapperne bliver så store som muligt.
  // Gitteret er (n + rw) × (n + ch) felter stort: rw og ch er pladsen til hints.
  // Gitterets ramme i alt (2 × temaets --pg-frame-w)
  var FRAME = 6;
  function readFrame() { FRAME = 2 * PixelgaaderTegn.cssNum('--pg-frame-w', 3); }
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  function hintFactors(n) {
    var L = G.clueSlots(n);
    // Et tal er ca. 0,4 felt højt; to cifre (fra 10 × 10) er bredere
    return { rw: L * (n >= 10 ? 0.6 : 0.4) + 0.3, ch: L * 0.44 + 0.2 };
  }
  var MAX_CELL = 190;
  function candidates(n, b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = Math.min(W, H) < 560 ? 10 : LUFT, hf = hintFactors(n);   // mobil (under 560 px): som før
    var hudH = Math.max(52, Math.min(84, b * 0.62)), hint = 60;
    function cell(aw, ah) { return Math.min(MAX_CELL, Math.floor(Math.min((aw - FRAME) / (n + hf.rw), (ah - FRAME) / (n + hf.ch)))); }
    var res = { p: p, g: g, hudH: hudH, ig: ig };
    // wide: status | gitter | tekst og værktøjer
    var sideW = Math.min(380, Math.max(230, b * 2.2));
    var leftH = 100 + 3 * hudH + 2 * ig + 70 + b + 3 * ig;
    var rightH = hint + 4 * b + 4 * ig;
    res.sideW = sideW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? cell(W - 2 * p - 2 * sideW - 2 * g, H - 2 * p) : 0;
    // side: gitter | (status, tekst, værktøjer og pause i k kolonner)
    res.side = 0;
    [1, 2, 3, 5].forEach(function (k) {
      var panelW = Math.max(k * b + (k - 1) * ig, k === 1 ? 150 : 0);
      var hudCols = panelW >= 3 * 110 + 2 * ig ? 3 : 1, hudRows = 3 / hudCols;
      var rows = Math.ceil(5 / k);
      var panelH = hudRows * hudH + (hudRows - 1) * ig + g + hint + ig + rows * b + (rows - 1) * ig;
      if (panelH > H - 2 * p) return;
      var c = cell(W - 2 * p - g - panelW, H - 2 * p);
      if (c > res.side) { res.side = c; res.sideK = k; res.panelSide = panelW; res.hudColsSide = hudCols; }
    });
    // below: status / gitter / tekst og værktøjer (på højkant ligger knapperne under gitteret)
    res.below = 0;
    [5, 3].forEach(function (k) {
      var needW = k * b + (k - 1) * ig;
      if (needW > W - 2 * p) return;
      var rows = Math.ceil(5 / k);
      var extra = hudH + g + hint + ig + rows * b + (rows - 1) * ig + g;
      var c = cell(W - 2 * p, H - 2 * p - extra);
      if (c > res.below) { res.below = c; res.belowK = k; }
    });
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; });
    return res;
  }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    // Status og værktøjer på hver sin side er rarest på store skærme: wide vinder ved næsten lige store felter
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    return best;
  }
  // Knapperne er så store som muligt (op til ca. 4 cm), men bliver mindre (dog aldrig
  // under ca. 80 px), hvis felterne på gitteret derved bliver mindst 5 % større.
  function bestFit(n, v) {
    readFrame();
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 20; k++) {
      var res = candidates(n, b, v.W, v.H, small), lay = pick(res);
      all.push({ b: b, res: res, lay: lay, cell: res[lay] || 0 });
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    var max = 0;
    all.forEach(function (o) { if (o.cell > max) max = o.cell; });
    for (var i = 0; i < all.length; i++) if (all[i].cell >= max / 1.05) return all[i];
    return all[all.length - 1];
  }
  function cellSizeFor(sizeId) { return bestFit(G.SIZES[sizeId].n, viewport()).cell; }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  var pauseBtn = $('#btn-pause'), toolsEl = $('#tools'), sideLeft = $('#side-left');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res, n, v) {
    var hf = hintFactors(n), rh = Math.round(cell * hf.rw), ch = Math.round(cell * hf.ch);
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    // Pausen står under status i wide, ellers sammen med værktøjerne
    if (lay === 'wide') { if (pauseBtn.parentNode !== sideLeft) sideLeft.appendChild(pauseBtn); }
    else if (pauseBtn.parentNode !== toolsEl) toolsEl.appendChild(pauseBtn);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--hud-h', Math.round(res.hudH) + 'px');
    st.setProperty('--cell', cell + 'px');
    st.setProperty('--rh', rh + 'px');
    st.setProperty('--ch', ch + 'px');
    st.setProperty('--clue-fs', Math.max(14, Math.min(46, Math.round(cell * 0.4))) + 'px');
    var bw = rh + n * cell + FRAME, bh = ch + n * cell + FRAME;
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var panelW, toolCols, hudCols;
    if (lay === 'wide') { panelW = res.sideW; toolCols = 1; hudCols = 1; }
    else if (lay === 'side') { panelW = res.panelSide; toolCols = res.sideK; hudCols = res.hudColsSide; }
    else { toolCols = res.belowK; panelW = Math.min(v.W - 2 * res.p, Math.max(bw, toolCols * b + (toolCols - 1) * res.ig)); hudCols = 3; }
    st.setProperty('--panel-w', Math.floor(panelW) + 'px');
    st.setProperty('--tool-cols', toolCols);
    st.setProperty('--hud-cols', hudCols);
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), n = run.n, small = isSmall(v);
    var floor = small ? SMALL_MIN : 84;
    var best = bestFit(n, v), b = best.b, lay, res, cell;
    for (var k = 0; k < 24; k++) {
      if (k === 0) { res = best.res; lay = best.lay; cell = best.cell; }
      else { res = candidates(n, b, v.W, v.H, small); lay = pick(res); cell = res[lay]; }
      if (!cell && b > floor) { b = Math.max(floor, b * 0.93); continue; }
      cell = Math.max(16, cell || 16);
      applyLayout(lay, b, cell, res, n, v);
      // Passer det ikke helt (fx lange tekster), så mindre felter, og derefter mindre knapper
      for (var t = 0; t < 12 && (overflows(gameEl) || overflows(root)) && cell > 16; t++) {
        cell = Math.max(16, Math.floor(cell * 0.96));
        applyLayout(lay, b, cell, res, n, v);
      }
      if (!overflows(gameEl) && !overflows(root)) break;
      if (b <= floor) break;
      b = Math.max(floor, b * 0.93);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('pg-lille', small);
    root.classList.toggle('pg-tvaers', small && v.W > v.H);
  }

  // Sider: blokkene (data-trin) fordeles på så få sider, som der er plads til.
  // Knapperne Forrige og Næste står i `navIn`, sammen med de faste knapper.
  function makePager(screen, opts) {
    var nav = document.createElement('div');
    nav.className = 'trin-nav';
    nav.hidden = true;
    nav.innerHTML = '<button class="btn trin-prev" aria-label="Forrige side"><span class="icon" aria-hidden="true">‹</span><span class="big">Forrige</span></button>' +
      '<span class="trin-label" aria-live="polite"></span>' +
      '<button class="btn trin-next" aria-label="Næste side"><span class="icon" aria-hidden="true">›</span><span class="big">Næste</span></button>';
    opts.navIn.appendChild(nav);
    // På højkant kan navigationen stå nederst i stedet (opts.navBottom)
    function placeNav() {
      var host = (opts.navBottom && !root.classList.contains('pg-tvaers')) ? opts.navBottom : opts.navIn;
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
    prev.addEventListener('click', function () { sfx('click'); showPage(idx - 1, true); });
    next.addEventListener('click', function () { sfx('click'); showPage(idx + 1, true); });
    return {
      // Alt vises igen (navigationen skjules)
      reset: function () {
        opts.all().forEach(function (el) { setHidden(el, false); });
        nav.hidden = true; pages = [];
        placeNav();
      },
      // Fordel blokkene på sider. keep: bliv på samme side (fx ved ændret vinduesstørrelse)
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

  // Game over på en lille skærm: resultatet og rekordlisten på hver sin side,
  // og én knap skifter mellem dem. Nyt spil står på begge sider.
  var goEl = $('#gameover'), goShowRecords = false;
  function setGoSplit(on) {
    goEl.classList.toggle('go-split', on);
    $('#btn-go-rec').hidden = !on;
    goEl.classList.toggle('go-vis-rekorder', on && goShowRecords);
    $('#go-rec-label').textContent = goShowRecords ? 'Resultat' : 'Rekorder';
    $('#go-rec-icon').textContent = goShowRecords ? '←' : '★';
  }
  $('#btn-go-rec').addEventListener('click', function () {
    sfx('click');
    goShowRecords = !goShowRecords;
    setGoSplit(true);
    fitScreen(goEl);
    $('#btn-go-rec').focus({ preventScroll: true });
  });

  // De andre skærme (og pauseboksene) tilpasses vinduet, til alt kan ses:
  // 1) mindre knapper og afstande (på små skærme aldrig under SMALL_MIN),
  // 2) valgfri tekst skjules, 3) indholdet deles på flere sider,
  // 4) til allersidst zoom som nødløsning (kun hvis vinduet er meget lille).
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
    var base = isOverlay ? (parseFloat(getComputedStyle(el).getPropertyValue('--btn')) || cssBtn(v.W, v.H)) : cssBtn(v.W, v.H);
    var minB = small ? SMALL_MIN : 52;
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('pg-tvaers')) {
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
    resizeTimer = setTimeout(fitCurrent, 150); // fx når adresselinjen på mobil skjules
  });

  // ---------- Start ----------
  PixelgaaderTegn.installerIkoner();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Pixelgaader = {
    mode: currentMode, availableSizes: availableSizes, maxSize: maxSize, askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get cursor() { return curIdx; }, get tool() { return tool; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, act: act, tip: showTip, setTool: setTool,
    next: nextPuzzle, finish: finish, showDone: showDone, refresh: refresh, cellSizeFor: cellSizeFor,
    setPaused: setPaused, layout: layoutGame
  };
})();
