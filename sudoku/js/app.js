/*
 * Sudoku – brugerflade: skærme, input, layout, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Pixelgåder og Kasser.
 *
 * To trin, så målene bliver store: vælg en boks (pladen zoomer ind på den),
 * vælg et felt i boksen, og vælg så et tal på det store talpanel. Et forkert tal
 * og et tip trækker point fra (aldrig under 0). Der er ingen tid og ingen liv.
 * Gåder uden ende – serien slutter, når spilleren vælger Afslut serien.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.SudokuGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // mode: sværhed (let, mellem, svaer). helpers: fremhæv række/kolonne/boks og ens tal.
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  var bset = ArkadeSettings.create('sudoku', { mode: 'let', helpers: true, gloed: true });
  var records = ArkadeHighscores.create('sudoku', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (G.DIFF_ORDER.indexOf(bset.get('mode')) < 0) bset.set('mode', 'let');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var lastPX = -1, lastPY = -1;
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') { lastPX = e.clientX; lastPY = e.clientY; }
    if (gazeGuard) releaseGuard(e.clientX, e.clientY);
  }, { passive: true });
  // Dwell-sikker skift: når en ny boks/plade vises, kan der ligge en knap præcis dér,
  // hvor blikket allerede er. Den knap kan ikke dwelles, før blikket har forladt den én gang.
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
    if (g.classList.contains('cell') || g.classList.contains('boxbtn')) renderBoard(); // tegnelaget styrer felternes dwell
  }

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul (alle rolige). Sudoku bruger disse navne:
  var SFX = {
    place: 'eat', note: 'move', erase: 'bonusGone', error: 'obstacle', unit: 'bonusSpawn', tip: 'bonusSpawn',
    zoom: 'move', solved: 'bonus', record: 'record', click: 'click', pause: 'pause', undo: 'bonusGone'
  };
  function sfx(name) { audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
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
      : 'Bevægelse i baggrunden og blød zoom på pladen. Fra giver faste skift';
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
  function applyGlow() { root.setAttribute('data-su-gloed', bset.get('gloed') ? 'til' : 'fra'); }
  bset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'helpers' || key === 'gloed') { syncSettingsUi(); renderBoard(); }
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
  function modeName(m) { return G.DIFFS[m] ? G.DIFFS[m].label : m; }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function puzzlesText(n) { return n === 1 ? '1 gåde' : n + ' gåder'; }
  function cellName(i) { return 'række ' + (G.row(i) + 1) + ', kolonne ' + (G.col(i) + 1); }
  function currentMode() { return bset.get('mode'); }

  // ---------- Startmenu ----------
  function syncMenu() {
    var mode = currentMode();
    $$('#menu [data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
    if (current === 'menu') fitScreen($('#menu'));
    if (current === 'menu') prepareFirst();
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
    audio.setMusic(false);
    [arkade, bset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) audio.setMusic(arkade.get('music'));
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
  var zoom = -1, sel = -1, notesMode = false;   // valgt boks (-1 = hele pladen), valgt felt, noter til/fra
  var boardEl = $('#board');
  var lastNote = '', noteCls = '', doneTimer = 0, overTimer = 0;

  // Tegningen af pladen ligger i js/tegn.js og læser kun spillets tilstand
  var tegn = SudokuTegn.create(boardEl);

  boardEl.addEventListener('click', function (e) {
    if (!live()) return;
    var bx = e.target.closest('.boxbtn');
    if (bx && zoom < 0) { zoomTo(+bx.dataset.box); return; }
    var c = e.target.closest('.cell');
    if (!c) return;
    var i = +c.dataset.i;
    if (zoom >= 0 && G.box(i) !== zoom) {
      // Felter uden for boksen er små (og ikke mål for dwell). Med mus og tryk skifter de boks.
      zoomTo(G.box(i), i);
      return;
    }
    select(i);
  });

  // Første gåde laves i forvejen, mens menuen står stille (Svær og Ekspert kan tage
  // et par hundrede ms), så Start spil reagerer med det samme.
  var firstPuzzle = null, firstTimer = 0;
  function prepareFirst() {
    clearTimeout(firstTimer);
    firstTimer = setTimeout(function () {
      var m = currentMode();
      if (current !== 'menu' || (firstPuzzle && firstPuzzle.diff === m)) return;
      firstPuzzle = G.generate(m);
    }, 700);
  }
  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    var m = currentMode(), pre = firstPuzzle && firstPuzzle.diff === m ? firstPuzzle : null;
    firstPuzzle = null; clearTimeout(firstTimer);
    run = G.createRun(m, pre ? { puzzle: pre } : undefined);
    paused = false; finished = false; zoom = -1; sel = -1; notesMode = false;
    lastNote = ''; noteCls = '';
    clearTimeout(doneTimer); clearTimeout(overTimer);
    tegn.build();
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !run.state.solved && !run.state.over && current === 'game' && !overlayOpen(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  function zoomTo(b, cell) {
    if (!live()) return;
    zoom = b;
    sel = cell >= 0 ? cell : (sel >= 0 && G.box(sel) === b ? sel : -1);
    setNote('', '');
    sfx('zoom');
    refresh();
    guardUnderGaze(boardEl);
  }
  function overview() {
    if (!live() || zoom < 0) return;
    zoom = -1;
    setNote('', '');
    sfx('click');
    refresh();
    guardUnderGaze(boardEl);
  }
  function select(i) {
    if (!live()) return;
    sel = i;
    var s = run.state;
    if (s.puzzle.givens[i]) setNote('Tallet ' + s.grid[i] + ' stod der fra starten. Ens tal er fremhævet.', '');
    else if (s.grid[i]) setNote('Feltet er udfyldt med ' + s.grid[i] + '.', '');
    else setNote('', '');
    sfx('click');
    refresh();
  }
  function unitText(done) {
    var names = { row: 'rækken', col: 'kolonnen', box: 'boksen' };
    var parts = done.map(function (k) { return names[k]; });
    if (!parts.length) return '';
    var t = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' og ' + parts[parts.length - 1];
    return t.charAt(0).toUpperCase() + t.slice(1) + (parts.length > 1 ? ' er fulde' : ' er fuld');
  }
  function digit(d) {
    if (!live()) return;
    if (sel < 0) { setNote(zoom < 0 ? 'Vælg først en boks og et felt' : 'Vælg først et felt i boksen', ''); refresh(); return; }
    var s = run.state;
    if (s.puzzle.givens[sel] || s.grid[sel]) { setNote('Feltet er allerede udfyldt. Vælg et tomt felt.', ''); refresh(); return; }
    if (notesMode) {
      var rn = run.toggleNote(sel, d);
      if (rn.ok) { sfx('note'); setNote(rn.result === 'note' ? 'Note ' + d + ' skrevet' : 'Note ' + d + ' fjernet', ''); }
      refresh();
      return;
    }
    var res = run.place(sel, d);
    if (!res.ok) { refresh(); return; }
    if (res.result === 'fejl') {
      var why = res.clash && res.clash.length ? ' (' + d + ' står allerede i samme ' + clashWhere(sel, res.clash[0]) + ')' : '';
      sfx('error');
      setNote(d + ' passer ikke her' + why + '. −' + pointsText(res.cost) + '.', 'err');
      refresh();
      return;
    }
    if (res.solved) { solvedNow(); return; }
    var ut = unitText(res.done);
    sfx(ut ? 'unit' : 'place');
    if (res.done.indexOf('box') >= 0 && zoom >= 0) {
      // Boksen er fuld: tilbage til hele pladen, så næste boks kan vælges
      zoom = -1; sel = -1;
      setNote(ut + '. Vælg en ny boks.', 'ok');
      refresh();
      guardUnderGaze(boardEl);
      return;
    }
    setNote(ut ? ut + '.' : '', ut ? 'ok' : '');
    refresh();
  }
  function clashWhere(i, j) {
    return G.row(i) === G.row(j) ? 'række' : G.col(i) === G.col(j) ? 'kolonne' : 'boks';
  }
  function solvedNow() {
    sfx('solved');
    setNote('Gåden er løst!', 'ok');
    zoom = -1; sel = -1;
    refresh();
    clearTimeout(doneTimer);
    doneTimer = setTimeout(showDone, animationOn() ? 900 : 600);
  }
  function erase() {
    if (!live()) return;
    if (sel < 0) { setNote('Vælg først et felt', ''); refresh(); return; }
    var r = run.erase(sel);
    if (r.ok) { sfx('erase'); setNote('Feltet er visket rent', ''); }
    else setNote(r.result === 'låst' ? 'Rigtige tal bliver stående. Visk fjerner kun noter og forkerte tal.' : 'Der er intet at viske ud her.', '');
    refresh();
  }
  function undo() {
    if (!live()) return;
    var r = run.undo();
    if (!r.ok) { setNote(run.state.undoLeft ? 'Der er intet at fortryde endnu.' : 'Du har brugt dit fortryd i denne gåde.', ''); refresh(); return; }
    sfx('undo');
    setNote('Sidste træk er fortrudt.', 'ok');
    refresh();
  }
  function tip() {
    if (!live()) return;
    var r = run.hint(sel);
    if (!r.ok) return;
    sfx('tip');
    if (run.state.solved) { solvedNow(); return; }
    if (zoom >= 0 && G.box(r.cell) !== zoom) zoom = G.box(r.cell);
    sel = r.cell;
    setNote('Tip: ' + r.digit + ' i ' + cellName(r.cell) + ' (−' + run.hintCost() + ' point)', 'tipnote');
    refresh();
  }
  function toggleNotes() {
    if (!live()) return;
    notesMode = !notesMode;
    sfx('click');
    setNote(notesMode ? 'Noter er slået til: tallene skrives som små blyantstal' : 'Noter er slået fra', '');
    refresh();
  }
  $$('#pad [data-digit]').forEach(function (b) { b.addEventListener('click', function () { digit(+b.dataset.digit); }); });
  $('#btn-notes').addEventListener('click', toggleNotes);
  $('#btn-erase').addEventListener('click', erase);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-tip').addEventListener('click', tip);
  $('#btn-overview').addEventListener('click', overview);

  // ---------- Tegning ----------
  function renderBoard() {
    if (!run || !tegn.ready) return;
    tegn.board(run, { zoom: zoom, sel: sel, helpers: bset.get('helpers'), live: live() });
    if (gazeGuard && (gazeGuard.classList.contains('cell') || gazeGuard.classList.contains('boxbtn'))) gazeGuard.setAttribute('data-no-dwell', '');
  }
  function defaultHint() {
    if (zoom < 0) return sel >= 0 ? 'Vælg et tal til ' + cellName(sel) + ' – eller vælg en boks' : 'Vælg en boks';
    if (sel < 0) return 'Vælg et felt i boksen';
    var s = run.state;
    if (s.grid[sel]) return 'Vælg et tomt felt i boksen';
    return notesMode ? 'Vælg en note til feltet' : 'Vælg et tal til feltet';
  }
  function refresh() {
    if (!run) return;
    var s = run.state, isLive = live();
    $('#hud-puzzle').textContent = s.index + 1;
    $('#hud-score').textContent = s.score;
    $('#hud-errors').textContent = s.errors;
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (s.solved && !txt) { txt = 'Gåden er løst!'; cls = 'ok'; }
    else if (!txt) txt = defaultHint();
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    var canWrite = isLive && sel >= 0 && !s.grid[sel];
    $$('#pad [data-digit]').forEach(function (b) {
      var d = +b.dataset.digit, left = 9 - run.digitCount(d);
      b.querySelector('.small').textContent = left ? (left === 1 ? '1 tilbage' : left + ' tilbage') : 'alle sat';
      b.disabled = !canWrite || (!notesMode && left === 0);
      b.setAttribute('aria-label', (notesMode ? 'Note ' : 'Tal ') + d + ', ' + (left ? left + ' tilbage' : 'alle sat'));
    });
    $('#side').classList.toggle('notes-on', notesMode);
    var nb = $('#btn-notes');
    nb.setAttribute('aria-pressed', String(notesMode)); nb.disabled = !isLive;
    $('#btn-erase').disabled = !isLive || sel < 0 || !!s.grid[sel] || (!s.notes[sel] && !s.wrong[sel]);
    $('#btn-undo').disabled = !run.canUndo();
    $('#undo-sub').textContent = s.undoLeft ? '1 tilbage' : 'brugt';
    $('#btn-tip').disabled = !isLive;
    $('#tip-sub').textContent = '−' + run.hintCost() + ' point';
    $('#btn-tip').setAttribute('aria-label', 'Tip: udfyld ' + (sel >= 0 && !s.grid[sel] ? 'det valgte felt' : 'et felt') + ' (koster ' + run.hintCost() + ' point)');
    $('#btn-overview').disabled = !isLive || zoom < 0;
    $('#btn-pause').disabled = !(run && !finished && !s.solved && !s.over);
    boardEl.setAttribute('aria-label', 'Sudoku, gåde ' + (s.index + 1) + (zoom >= 0 ? ', boks ' + SudokuTegn.BOX_NAMES[zoom] : ''));
    renderBoard();
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Gåde løst ----------
  function showDone() {
    if (!run || !run.state.solved || finished) return;
    var s = run.state, pt = s.lastPoints;
    $('#done-kicker').textContent = modeName(s.diff);
    $('#done-title').textContent = 'Gåde ' + (s.index + 1) + ' løst';
    $('#done-points').textContent = '+' + pointsText(pt.award);
    var parts = [pt.base + ' for gåden'];
    if (pt.bonus) parts.push(pt.bonus + ' i bonus for fejlfri uden tip');
    var spent = [];
    if (pt.errorCost) spent.push(pt.errorCost + ' for ' + (s.errors === 1 ? '1 fejl' : s.errors + ' fejl'));
    if (pt.tipCost) spent.push(pt.tipCost + ' for ' + (s.tips === 1 ? '1 tip' : s.tips + ' tip'));
    $('#done-parts').textContent = parts.join(' · ') + (spent.length ? ' (undervejs trukket fra: ' + spent.join(' og ') + ')' : '') + '. I alt ' + pointsText(s.score) + '.';
    // Lav næste gåde, mens spilleren læser (så "Næste gåde" er øjeblikkelig)
    setTimeout(function () { if (run && run.state.solved && !finished) run.prefetch(); }, 60);
    $('#btn-next-sub').textContent = 'Gåde ' + (s.index + 2) + ' · ' + modeName(s.diff);
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
    zoom = -1; sel = -1; setNote('', '');
    sfx('click');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
    guardUnderGaze(boardEl);
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
  var lastEntryId = null;
  function saveRecord() {
    var s = run.state, out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(s.diff, out.score, { levels: out.solved });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimeout(doneTimer); clearTimeout(overTimer);
    var s = run.state, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-title').textContent = 'Serien er slut';
    $('#go-reason').textContent = modeName(s.diff) + ': ' + (s.solved ? 'du afsluttede efter gåde ' + (s.index + 1) + '.' : 'du afsluttede på gåde ' + (s.index + 1) + '.');
    $('#go-score').textContent = s.score;
    var bits = [puzzlesText(s.solvedCount) + ' løst'];
    if (s.perfectCount) bits.push(s.perfectCount + ' fejlfri');
    if (s.totalErrors) bits.push(s.totalErrors === 1 ? '1 fejl' : s.totalErrors + ' fejl');
    if (s.totalTips) bits.push(s.totalTips === 1 ? '1 tip' : s.totalTips + ' tip');
    $('#go-levels').textContent = bits.join(' · ');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = modeName(s.diff);
    $('#go-records-title').textContent = 'Rekorder – ' + modeName(s.diff);
    renderRecordList($('#go-records'), s.diff, lastEntryId);
    show('gameover');
  }
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

  // ---------- Rekorder ----------
  var recMode = 'let';
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
  // Piletasterne flytter markøren (følger med boksen, når der er zoomet ind),
  // 1–9 sætter et tal, N noter, Backspace/Delete/0 visker, U fortryder, T tip,
  // O hele pladen, Enter på en boks zoomer ind (via knappens fokus), Esc eller P pause.
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function moveCursor(d) {
    if (!live()) return;
    var i = sel;
    if (i < 0) i = zoom >= 0 ? G.boxCells(zoom)[4] : 40;
    else {
      var x = Math.max(0, Math.min(8, G.col(i) + d[0])), y = Math.max(0, Math.min(8, G.row(i) + d[1]));
      i = y * 9 + x;
    }
    sel = i;
    if (zoom >= 0) zoom = G.box(i);
    setNote('', '');
    refresh();
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (/^[1-9]$/.test(k)) { if (!e.repeat) { if (sel < 0) moveCursor([0, 0]); else digit(+k); } }
    else if (k === 'Backspace' || k === 'Delete' || k === '0') { if (!e.repeat) erase(); }
    else if (k === 'n') { if (!e.repeat) toggleNotes(); }
    else if (k === 'u' || k === 'z') { if (!e.repeat) undo(); }
    else if (k === 't') { if (!e.repeat) tip(); }
    else if (k === 'o') { if (!e.repeat) overview(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && !document.activeElement.classList.contains('boxbtn')) document.activeElement.blur();
  });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css), ellers
  // så store som muligt (mindst ca. 80 px). Layoutet, der giver den største plade, vælges.
  var LAYOUTS = ['side', 'below'];
  var NBTN = 15; // 9 tal + Noter, Visk, Fortryd, Tip, Hele pladen og Pause
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(28, mn * 0.024)) }; }
  var MAX_BOARD = 1400;
  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = small ? 8 : 10;
    var hudH = Math.round(Math.max(48, Math.min(80, b * 0.55)));
    var hintH = small ? 44 : 58;
    var res = { p: p, g: g, ig: ig, hudH: hudH, hintH: hintH, side: 0, below: 0 };
    function panel(k) {
      var rows = Math.ceil(NBTN / k), w = k * b + (k - 1) * ig;
      var hudCols = w >= 290 ? 3 : 1;
      var hudBlock = hudCols === 3 ? hudH : 3 * hudH + 2 * ig;
      return { k: k, w: w, hudCols: hudCols, h: hudBlock + ig + hintH + ig + rows * b + (rows - 1) * ig };
    }
    [3, 4, 5].forEach(function (k) {
      var pn = panel(k);
      if (pn.h > H - 2 * p) return;
      var S = Math.min(MAX_BOARD, H - 2 * p, W - 2 * p - g - pn.w);
      if (S > res.side) { res.side = S; res.sideP = pn; }
    });
    [3, 4, 5, 6, 8].forEach(function (k) {
      var pn = panel(k);
      if (pn.w > W - 2 * p) return;
      var S = Math.min(MAX_BOARD, W - 2 * p, H - 2 * p - g - pn.h);
      if (S > res.below) { res.below = S; res.belowP = pn; }
    });
    LAYOUTS.forEach(function (l) { res[l] = Math.floor(res[l]); if (!(res[l] >= 120)) res[l] = 0; });
    return res;
  }
  function pick(res) { return res.side >= res.below * 0.96 ? 'side' : 'below'; }
  // Knapperne er så store som muligt (op til ca. 4 cm), men bliver mindre (dog aldrig
  // under ca. 80 px), hvis pladen derved bliver mindst 5 % større.
  function bestFit(v) {
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 24; k++) {
      var res = candidates(b, v.W, v.H, small), lay = pick(res);
      all.push({ b: Math.floor(b), res: res, lay: lay, S: res[lay] || 0 });
      if (b <= floor) break;
      b = Math.max(floor, b * 0.95);
    }
    var max = 0;
    all.forEach(function (o) { if (o.S > max) max = o.S; });
    for (var i = 0; i < all.length; i++) if (all[i].S >= max / 1.05) return all[i];
    return all[all.length - 1];
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(fit, S, v) {
    var res = fit.res, lay = fit.lay, pn = res[lay + 'P'], b = fit.b;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ig', res.ig + 'px');
    st.setProperty('--hud-h', res.hudH + 'px');
    st.setProperty('--hint-h', res.hintH + 'px');
    st.setProperty('--hint-fs', (res.hintH < 50 ? 0.95 : 1.1) + 'rem');
    st.setProperty('--board', S + 'px');
    st.setProperty('--pad-cols', pn.k);
    st.setProperty('--hud-cols', pn.hudCols);
    st.setProperty('--panel-w', Math.max(pn.w, lay === 'below' ? Math.min(S, v.W - 2 * res.p) : 0) + 'px');
    gridEl.classList.toggle('compact-hud', res.hudH < 64);
    // Zoom: den valgte boks' felter fylder en brøkdel f af pladen hver (mindst ca. 84 px,
    // når der er plads), de seks andre rækker og kolonner deler resten.
    var inner = S - 2 * SudokuTegn.cssNum('--su-frame-w', 3);
    var f = Math.min(0.233, Math.max(0.2, 84 / inner));
    if (inner < 420) f = Math.min(0.225, f); // lille plade: lidt mindre zoom, så resten af pladen kan læses
    st.setProperty('--su-zf', (6 * f / (1 - 3 * f)).toFixed(3) + 'fr');
    gameEl.dataset.layout = lay;
    gameEl.dataset.board = S;
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), fit = bestFit(v), S = Math.max(120, fit.S || 120);
    applyLayout(fit, S, v);
    for (var t = 0; t < 16 && (overflows(gameEl) || overflows(root)) && S > 120; t++) {
      S = Math.max(120, Math.floor(S * 0.96));
      applyLayout(fit, S, v);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 80, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('su-lille', small);
    root.classList.toggle('su-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('su-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('su-tvaers')) {
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
  SudokuTegn.installerIkoner();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Sudoku = {
    get run() { return run; }, get zoom() { return zoom; }, get sel() { return sel; }, get notesMode() { return notesMode; },
    get guard() { return gazeGuard ? (gazeGuard.id || gazeGuard.className) : null; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, zoomTo: zoomTo, select: select, digit: digit, erase: erase, undo: undo, tip: tip,
    toggleNotes: toggleNotes, overview: overview, askQuit: askQuit, cancelQuit: cancelQuit,
    next: nextPuzzle, finish: finish, showDone: showDone, refresh: refresh, setPaused: setPaused, layout: layoutGame
  };
})();
