/*
 * Fire på stribe – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Lys ud og Blokke.
 *
 * Vælg en kolonne (klik, tryk, dwell, piletaster eller 1–7 og Enter): brikken
 * falder ned. Computeren svarer i ro og mag. Fire på stribe vinder partiet.
 * Sejr og uafgjort giver point, og serien fortsætter. Et tab afslutter serien.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.FirePaaStribeGame;
  var YOU = G.YOU, CPU = G.CPU, COLS = G.COLS, ROWS = G.ROWS;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // level: computerens niveau. ghost: vis svagt, hvor brikken lander. gloed: temaets glød (kan slås fra).
  var gset = ArkadeSettings.create('firepaastribe', { level: G.DEFAULT_LEVEL, ghost: true, gloed: true });
  var records = ArkadeHighscores.create('firepaastribe', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.LEVELS[gset.get('level')]) gset.set('level', G.DEFAULT_LEVEL);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = én handling. Dwell-modulet slipper sin lås, hvis en knap bliver
  // deaktiveret et øjeblik (fx mens computeren tænker). Derfor holder spillet sin
  // egen lås på kolonnerne, Slip, Fortryd og Tip: samme mål kan først dwelles
  // igen, når blikket har forladt det.
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
  // Lydene kommer fra det fælles lydmodul (alle rolige). Fire på stribe bruger disse navne:
  var SFX = {
    you: 'move', cpu: 'click', undo: 'bonusGone', tip: 'bonusSpawn', win: 'bonus', draw: 'bonusSpawn',
    loss: 'crash', record: 'record', click: 'click', pause: 'pause'
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
      : 'Bevægelse i baggrunden og brikker, der falder roligt. Fra giver faste skift';
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
  // Glød er en temaeffekt: data-gloed="fra" på <html> slår den fra i temaets CSS
  function applyGlow() { root.setAttribute('data-gloed', gset.get('gloed') ? 'til' : 'fra'); }
  gset.onChange(function (key) {
    if (key === 'ghost') { syncSettingsUi(); renderBoard(); }
    if (key === 'gloed') { applyGlow(); syncSettingsUi(); }
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
  function levelName(id) { return G.LEVELS[id].name; }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function movesText(n) { return n === 1 ? '1 træk' : n + ' træk'; }
  function winsText(n) { return n === 1 ? '1 sejr' : n + ' sejre'; }
  function drawsText(n) { return n + ' uafgjort'; }
  function seriesText(w, d) { return winsText(w) + ' og ' + drawsText(d); }

  // ---------- Startmenu ----------
  function level() { return gset.get('level'); }
  function syncMenu() {
    $$('#menu [data-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.level === level())); });
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-level]').forEach(function (b) {
    b.addEventListener('click', function () { gset.set('level', b.dataset.level); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(level()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, gset].forEach(function (s) {
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

  // ---------- Spillet ----------
  var run = null, paused = false, finished = false;
  var hoverCol = -1, curCol = -1;     // kolonnen under blikket/musen og den valgte (tastatur/vælger)
  var busy = false;                   // en brik falder, eller computeren tænker
  var falling = -1, fallingMs = 0;    // feltet med den brik, der falder lige nu
  var cpuTimer = 0, animTimer = 0, pendingCpu = false;
  var lastNote = '';
  var boardEl = $('#board');
  var tegn = FirePaaStribeTegn.create(boardEl);   // tegnelaget: al grafik kommer fra temaet
  function buildBoard() { tegn.build(); }
  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.col');
    if (!c || swallowed(c)) return;
    dropCol(+c.dataset.c);
  });
  // Ghost-brikken følger blikket og musen (ikke fingre: her slippes brikken ved tryk)
  boardEl.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var c = e.target.closest('.col');
    var i = c ? +c.dataset.c : -1;
    if (i !== hoverCol) { hoverCol = i; if (i >= 0) curCol = -1; renderBoard(); }
  });
  boardEl.addEventListener('pointerleave', function () { if (hoverCol >= 0) { hoverCol = -1; renderBoard(); } });

  function clearTimers() { clearTimeout(cpuTimer); clearTimeout(animTimer); cpuTimer = animTimer = 0; pendingCpu = false; }
  function startGame() {
    clearTimers();
    run = G.createSeries(level());
    paused = false; finished = false; busy = false; falling = -1;
    hoverCol = -1; curCol = -1; lastNote = '';
    buildBoard();
    hideOverlays();
    show('game');
    beginGame();
  }
  function beginGame() {
    $('#end-row').hidden = true; $('#act-row').hidden = false;
    releaseGuard();
    lastNote = run.state.starter === CPU ? 'Computeren starter dette parti' : 'Du starter dette parti';
    refresh();
    if (run.state.turn === CPU) scheduleCpu();
  }
  var OVERLAYS = ['#pause-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !run.state.result && current === 'game' && !overlayOpen(); }
  function canPlay() { return live() && !busy && run.state.turn === YOU; }

  // Faldet: roligt, og længere for computerens brik. Uden animation lander den med det samme.
  function fallTime(row, who) {
    if (!animationOn()) return 0;
    return Math.round((who === CPU ? 520 : 300) + row * (who === CPU ? 70 : 45));
  }
  function animateDrop(res) {
    var ms = fallTime(res.row, res.player);
    falling = ms ? G.idx(res.row, res.col) : -1;
    fallingMs = ms;
    return ms;
  }
  function dropCol(c) {
    if (!canPlay()) return;
    if (!G.canDrop(run.state.board, c)) { lastNote = 'Kolonne ' + (c + 1) + ' er fuld'; refresh(); return; }
    var res = run.play(c);
    if (!res.ok) return;
    sfx('you');
    lastNote = '';
    if (curCol >= 0) curCol = c;
    var ms = animateDrop(res);
    busy = true;
    refresh();
    animTimer = setTimeout(function () {
      falling = -1; busy = false;
      if (res.result) gameEnded(); else scheduleCpu();
    }, ms);
  }
  // Computeren tænker uden tidspres: en kort, rolig pause, så brikken falder langsomt ned.
  function scheduleCpu() {
    busy = true;
    refresh();
    cpuTimer = setTimeout(cpuStep, animationOn() ? 700 : 400);
  }
  function cpuStep() {
    cpuTimer = 0;
    if (!run || finished) return;
    if (paused || overlayOpen() || current !== 'game') { pendingCpu = true; return; }
    var res = run.cpuPlay();
    if (!res.ok) { busy = false; refresh(); return; }
    sfx('cpu');
    var ms = animateDrop(res);
    refresh();
    animTimer = setTimeout(function () {
      falling = -1; busy = false;
      if (res.result) gameEnded(); else { lastNote = 'Computeren lagde i kolonne ' + (res.col + 1); refresh(); }
    }, ms);
  }
  function resumeCpu() { if (pendingCpu && run && !finished) { pendingCpu = false; scheduleCpu(); } }

  function undoMove() {
    if (!canPlay() || !run.canUndo()) return;
    run.undo();
    sfx('undo');
    lastNote = 'Fortrudt: −' + G.RULES.undoCost + ' point i partiet';
    refresh();
  }
  function showTip() {
    if (!canPlay()) return;
    var had = run.state.hintCol;
    var c = run.hint();
    if (c < 0) return;
    if (had < 0) { sfx('tip'); lastNote = 'Tip: kolonne ' + (c + 1) + ' (−' + G.RULES.hintCost + ' point)'; }
    if (curCol >= 0) curCol = c;
    refresh();
  }

  // ---------- Vælger (små skærme) og tastatur ----------
  function pickStart() { return curCol >= 0 ? curCol : (hoverCol >= 0 ? hoverCol : 3); }
  function moveCursor(d) {
    if (!live()) return;
    var c = curCol < 0 ? pickStart() : Math.max(0, Math.min(COLS - 1, curCol + d));
    curCol = c; hoverCol = -1;
    renderBoard();
  }
  function setCursor(c) { if (!live()) return; curCol = c; hoverCol = -1; renderBoard(); }
  function dropCursor() {
    if (!canPlay()) return;
    if (curCol < 0) { curCol = pickStart(); renderBoard(); return; }  // første tryk viser, hvor brikken lander
    dropCol(curCol);
  }
  $('#btn-left').addEventListener('click', function () { moveCursor(curCol < 0 ? 0 : -1); });
  $('#btn-right').addEventListener('click', function () { moveCursor(curCol < 0 ? 0 : 1); });
  $('#btn-drop').addEventListener('click', function () { if (!swallowed(this)) { if (curCol < 0) curCol = pickStart(); dropCol(curCol); } });

  // ---------- Tegning ----------
  // Visningen: hvad der skal vises ud fra spillets tilstand. Tegnelaget (js/tegn.js) tegner den.
  function renderBoard() {
    if (!run || !tegn.ready) return;
    var s = run.state, b = s.board;
    var play = canPlay();
    var focus = play ? (hoverCol >= 0 ? hoverCol : curCol) : -1;
    var ghost = -1;
    if (focus >= 0 && gset.get('ghost')) { var gr = G.landingRow(b, focus); if (gr >= 0) ghost = G.idx(gr, focus); }
    var tipIdx = -1;
    if (play && s.hintCol >= 0) { var tr = G.landingRow(b, s.hintCol); if (tr >= 0) tipIdx = G.idx(tr, s.hintCol); }
    var win = {}; (s.winCells || []).forEach(function (i) { win[i] = 1; });
    tegn.render({
      board: b, focus: focus, cur: curCol, tipCol: s.hintCol, play: play,
      ghost: ghost, tipIdx: tipIdx, win: win,
      last: s.lastMove && !s.result ? G.idx(s.lastMove.row, s.lastMove.col) : -1,
      ended: !!s.result && s.result !== 'draw',
      falling: falling, fallingMs: fallingMs
    });
    // Vælgerens knapper
    var pd = !play;
    setAria($('#btn-left'), pd || curCol === 0);
    setAria($('#btn-right'), pd || curCol === COLS - 1);
    setAria($('#btn-drop'), pd || (curCol >= 0 && !G.canDrop(b, curCol)));
  }
  function setAria(el, off) { if ((el.getAttribute('aria-disabled') === 'true') !== off) el.setAttribute('aria-disabled', String(off)); }
  function discHtml(p) { return FirePaaStribeTegn.miniBrik(p); }

  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-score').textContent = s.score;
    $('#hud-game').textContent = s.game;
    $('#hud-wins').textContent = s.wins;
    $('#hud-draws').textContent = s.draws;
    var note = lastNote;
    if (!note && !s.result) {
      var pts = G.gamePoints('win', s.youMoves + 1, s.level, s.penalty).total;
      note = 'Vinder du nu: +' + pts + ' point';
    }
    if (s.result) note = s.result === 'loss' ? 'Serien er slut' : '+' + pointsText(s.lastPoints.total) + ' for partiet';
    $('#points-note').textContent = note;
    var hint = $('#hint'), cls = '', html;
    if (s.result === 'win') { html = 'Du fik fire på stribe! +' + s.lastPoints.total; cls = 'ok'; }
    else if (s.result === 'draw') { html = 'Uafgjort – brættet er fuldt. +' + s.lastPoints.total; cls = 'ok'; }
    else if (s.result === 'loss') { html = 'Computeren fik fire på stribe'; cls = 'lost'; }
    else if (paused) html = 'Pause';
    else if (s.turn === CPU) { html = discHtml(2) + 'Computeren tænker …'; cls = 'cpu'; }
    else if (busy) html = discHtml(1) + 'Din brik falder …';
    else if (s.hintCol >= 0) { html = 'Tip: kolonne ' + (s.hintCol + 1) + ' med den grønne brik'; cls = 'tipnote'; }
    else html = discHtml(1) + 'Din tur – vælg en kolonne';
    if (hint.innerHTML !== html) hint.innerHTML = html;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    var play = canPlay();
    setAria($('#btn-undo'), !play || !run.canUndo());
    $('#undo-sub').textContent = s.undosUsed >= G.RULES.maxUndo ? 'brugt i partiet' : 'ét træk, −' + G.RULES.undoCost + ' point';
    var tipShown = s.hintCol >= 0;
    setAria($('#btn-tip'), !play || tipShown);
    $('#tip-sub').textContent = tipShown ? 'vises nu' : '−' + G.RULES.hintCost + ' point';
    boardEl.setAttribute('aria-label', 'Brættet, parti ' + s.game + '. ' + (s.turn === YOU ? 'Din tur.' : 'Computerens tur.'));
    renderBoard();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  $('#btn-undo').addEventListener('click', function () { if (!swallowed(this)) undoMove(); });
  $('#btn-tip').addEventListener('click', function () { if (!swallowed(this)) showTip(); });

  // ---------- Partiet er slut ----------
  // Brættet bliver stående med de vindende fire markeret (uden blink). Fortryd og Tip
  // skifter til "Næste parti" og "Afslut" – eller "Se resultat", hvis du tabte.
  function gameEnded() {
    var s = run.state;
    sfx(s.result);
    lastNote = '';
    $('#act-row').hidden = true;
    var er = $('#end-row'); er.hidden = false;
    var lost = s.result === 'loss';
    $('#btn-next-label').textContent = lost ? 'Se resultat' : 'Næste parti';
    $('#btn-next-sub').textContent = lost ? 'og rekorder' : 'Parti ' + (s.game + 1);
    $('#btn-end-quit').hidden = lost;
    refresh();
    layoutGame();
    dwell.reset();
    guardUnderGaze(er);
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextGame() {
    if (!run || finished || !run.state.result) return;
    if (run.state.result === 'loss') { sfx('click'); finish(); return; }
    run.nextGame();
    sfx('click');
    hoverCol = -1;
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    beginGame();
  }
  $('#btn-next').addEventListener('click', nextGame);
  $('#btn-end-quit').addEventListener('click', function () { sfx('click'); askQuit('end'); });

  function setPaused(p) {
    if (!run || finished) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
    else resumeCpu();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit('pause'); });

  // ---------- Bekræft Afslut ----------
  var confirmFrom = null;
  function askQuit(from) {
    if (!run || finished) return;
    confirmFrom = from;
    $('#pause-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ', ' + seriesText(s.wins, s.draws) + '. Pointene gemmes i rekorderne.';
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
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
    if (confirmFrom === 'end' && run && run.state.result) $('#btn-next').focus({ preventScroll: true });
    resumeCpu();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish(); });
  function quitToMenu() { clearTimers(); run = null; paused = false; hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  // Serien gemmes som rekord pr. niveau: point, sejre og uafgjorte.
  var lastEntryId = null;
  function saveRecord() {
    var s = run.state, out = run.end(), res = null;
    finished = true;
    if (out.score > 0) res = records.add(s.level, out.score, { wins: out.wins, draws: out.draws });
    return res;
  }
  function finish() {
    if (finished || !run) return;
    clearTimers();
    var s = run.state, lost = s.result === 'loss', res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-reason').textContent = lost ? 'Computeren vandt parti ' + s.game + '.' : 'Du afsluttede i parti ' + s.game + '.';
    $('#go-score').textContent = s.score;
    $('#go-games').textContent = seriesText(s.wins, s.draws) + ' · ' + levelName(s.level);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = levelName(s.level);
    $('#go-records-title').textContent = 'Rekorder – ' + levelName(s.level);
    renderRecordList($('#go-records'), s.level, lastEntryId);
    show('gameover');
  }
  // Lukkes siden midt i en serie, gemmes den alligevel
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
        lv.textContent = ' · ' + winsText(typeof e.wins === 'number' ? e.wins : 0) + (e.draws ? ', ' + drawsText(e.draws) : '');
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
  var recLevel = G.DEFAULT_LEVEL;
  function openRecords(lv) { recLevel = lv; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recLevel === recLevel)); });
    $('#rec-title').textContent = 'Rekorder – ' + levelName(recLevel);
    renderRecordList($('#rec-list'), recLevel, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-level]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recLevel = b.dataset.recLevel; syncRecords(); });
  });
  $('#btn-records-back').addEventListener('click', function () { sfx('click'); show('menu'); });

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
  function onFs() { syncFullscreen(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

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
    $$('#settings [data-gset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(gset.get(b.dataset.gset)) === b.dataset.value));
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
  $$('#settings [data-gset]').forEach(function (b) {
    b.addEventListener('click', function () { gset.set(b.dataset.gset, b.dataset.value === 'true'); sfx('click'); syncSettingsUi(); });
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
    if (settingsReturn === 'game' && run && !finished) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });


  // ---------- Tastatur ----------
  // Venstre/højre pil eller 1–7 vælger kolonne, Enter, mellemrum eller pil ned slipper
  // brikken, Z eller Backspace fortryder, T giver et tip, Esc eller P giver pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (/^Arrow/.test(e.key)) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    if (run && run.state.result) return; // Næste parti / Se resultat har fokus
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (k === 'ArrowLeft') moveCursor(curCol < 0 ? 0 : -1);
    else if (k === 'ArrowRight') moveCursor(curCol < 0 ? 0 : 1);
    else if (/^[1-7]$/.test(k)) setCursor(+k - 1);
    else if (k === 'Enter' || k === ' ' || k === 'ArrowDown') { if (!e.repeat) dropCursor(); }
    else if (k === 'z' || k === 'Backspace') { if (!e.repeat) undoMove(); }
    else if (k === 't' || k === 'h') { if (!e.repeat) showTip(); }
    else if (k === 'ArrowUp') { /* intet */ }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ' && !(run && run.state.result)) e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Kolonnerne er de store mål: det layout, der giver de bredeste kolonner, vælges.
  // Bliver kolonnerne smallere end ca. 80 px, kommer der en vælger med store knapper
  // (◀ Slip ▶) under eller ved siden af brættet.
  //  wide:  status til venstre, brættet i midten, knapper til højre
  //  side:  brættet til venstre; status og knapper i én søjle til højre
  //  pside: brættet til venstre; kompakt panel med vælger (lav skærm, fx mobil på tværs)
  //  below: status øverst, brættet i midten, vælger og knapper under (højkant)
  var BOARD_EXTRA = 18;       // ramme og indre margen i alt
  var PICK_UNDER = 80;        // kolonner smallere end dette giver vælgeren
  var LAYOUTS = ['wide', 'side', 'pside', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }

  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 8;
    var hudH = Math.max(52, Math.min(84, b * 0.62)), pauseS = Math.max(small ? SMALL_MIN : 84, hudH);
    var top = Math.max(hudH + 6, pauseS), hint = 52;
    var gw = Math.max(10, cssGap(W, H) * 0.45);
    function cellW(px) { return Math.floor((px - BOARD_EXTRA) / COLS); }
    function cellH(px) { return Math.floor((px - BOARD_EXTRA) / ROWS); }
    var res = { p: p, g: g, top: top, pauseS: pauseS, hudH: hudH, pick: {} };
    var availH = H - 2 * p;
    // wide
    var sideW = Math.min(380, Math.max(240, b * 2));
    var leftH = 90 + 2 * 78 + 40 + 60 + b + 4 * gw;
    var cw = cellW(W - 2 * p - 2 * sideW - 2 * g);
    var wPick = Math.min(cw, cellH(availH)) < PICK_UNDER;
    var rightH = hint + 2 * b + (wPick ? b : 0) + 3 * gw;
    res.sideW = sideW;
    res.wide = (rightH <= availH && leftH <= availH && (!wPick || sideW >= 3 * b * 0.8)) ? Math.min(cw, cellH(availH)) : 0;
    res.pick.wide = wPick;
    // side: én søjle med status, tekst, Fortryd, Tip og pause
    var colW = Math.max(240, b * 2);
    var sideH = 2 * 78 + 40 + hint + 3 * b + 6 * gw;
    var sc = Math.min(cellW(W - 2 * p - g - colW), cellH(availH));
    res.colW = colW;
    res.side = (sideH <= availH && sc >= PICK_UNDER) ? sc : 0;
    res.pick.side = false;
    // pside: kompakt panel med vælger
    var panelW = 3 * b + 2 * ig;
    var panelH = top + hint + 2 * b + 3 * ig;
    res.panelSide = panelW;
    res.pside = panelH <= availH ? Math.min(cellW(W - 2 * p - g - panelW), cellH(availH)) : 0;
    res.pick.pside = true;
    // below
    var bw = cellW(W - 2 * p);
    var noPick = Math.min(bw, cellH(availH - top - hint - b - ig - 3 * g));
    if (noPick >= PICK_UNDER && 2 * b + ig <= W - 2 * p) { res.below = noPick; res.pick.below = false; }
    else {
      res.below = (3 * b + 2 * ig <= W - 2 * p) ? Math.min(bw, cellH(availH - top - hint - 2 * b - 2 * ig - 3 * g)) : 0;
      res.pick.below = true;
    }
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 24)) res[l] = 0; });
    return res;
  }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    // Status og knapper på hver sin side af brættet er rarest på store skærme
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    return best;
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function pickOn() { return gridEl.classList.contains('pick-on'); }
  function applyLayout(lay, b, cell, res, v) {
    var bw = cell * COLS + BOARD_EXTRA, bh = cell * ROWS + BOARD_EXTRA;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay === 'pside' || lay === 'below');
    gridEl.classList.toggle('pick-on', !!res.pick[lay]);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(lay === 'side' ? res.colW : res.sideW) + 'px');
    st.setProperty('--pause-s', Math.round(res.pauseS) + 'px');
    st.setProperty('--cell', cell + 'px');
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var panelW = lay === 'pside' ? res.panelSide : Math.min(v.W - 2 * res.p, Math.max(bw, 3 * b + 16));
    st.setProperty('--panel-w', Math.floor(panelW) + 'px');
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), small = isSmall(v);
    var floor = small ? SMALL_MIN : 52;
    var b = Math.max(floor, cssBtn(v.W, v.H)), lay, res, cell;
    for (var k = 0; k < 24; k++) {
      res = candidates(b, v.W, v.H, small);
      lay = pick(res);
      cell = res[lay];
      if (!cell && b > floor) { b = Math.max(floor, b * 0.93); continue; }
      cell = Math.max(24, cell || 24);
      applyLayout(lay, b, cell, res, v);
      // Passer det ikke helt (fx lange tekster), så mindre felter, og derefter mindre knapper
      for (var t = 0; t < 12 && (overflows(gameEl) || overflows(root)) && cell > 24; t++) {
        cell = Math.max(24, Math.floor(cell * 0.96));
        applyLayout(lay, b, cell, res, v);
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
    root.classList.toggle('fp-lille', small);
    root.classList.toggle('fp-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('fp-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('fp-tvaers')) {
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
  FirePaaStribeTegn.ikoner(document);   // temaets ikoner i knapperne
  applyGlow();
  syncSmall();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.FirePaaStribe = {
    level: level, askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get cursor() { return curCol; }, get busy() { return busy; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, drop: dropCol, undo: undoMove, tip: showTip, next: nextGame,
    finish: finish, refresh: refresh, layout: layoutGame, setPaused: setPaused,
    // Kun til test: sæt en plade og (valgfrit) vent ikke på computeren
    setBoard: function (b, turn) { clearTimers(); busy = false; falling = -1; run._setBoard(b, turn); $('#end-row').hidden = true; $('#act-row').hidden = false; refresh(); if (run.state.turn === CPU) scheduleCpu(); }
  };
})();
