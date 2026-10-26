/*
 * Slangen – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var slangen = ArkadeSettings.create('slangen', { boardSize: 15 });
  var records = ArkadeHighscores.create('slangen', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  var SIZES = [10, 15, 20];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (SIZES.indexOf(slangen.get('boardSize')) < 0) slangen.set('boardSize', 15);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });

  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  var colors = {};
  function readColors() {
    colors = {
      board: cssVar('--c-board'), grid: cssVar('--c-grid'),
      snake: cssVar('--c-snake'), head: cssVar('--c-head'), headRim: cssVar('--c-head-rim'), eye: cssVar('--c-eye'),
      food: cssVar('--c-food'), bonus: cssVar('--c-bonus'), bonusText: cssVar('--c-bonus-text'),
      obstacle: cssVar('--c-obstacle'), obstacleFill: cssVar('--c-obstacle-fill'), crash: cssVar('--c-crash'),
      glow: cssVar('--glow') !== '0'
    };
  }
  function animationOn() { return arkade.get('animation') && !reducedMotionMq.matches; }
  function applyTheme() {
    root.setAttribute('data-theme', arkade.get('theme'));
    readColors();
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = cssVar('--bg');
    bg.setPalette({
      bg0: cssVar('--p-bg0'), bg1: cssVar('--p-bg1'), sky0: cssVar('--p-sky0'), sky1: cssVar('--p-sky1'),
      sky2: cssVar('--p-sky2'), sun0: cssVar('--p-sun0'), sun1: cssVar('--p-sun1'), grid: cssVar('--p-grid'),
      light1: cssVar('--p-light1'), light2: cssVar('--p-light2')
    });
    drawBoard();
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    var note = $('#motion-note');
    note.textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Langsom bevægelse i baggrunden';
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

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'game') layoutGame();
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var size = slangen.get('boardSize');
    $$('#menu [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size)); });
  }
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () { slangen.set('boardSize', Number(b.dataset.size)); syncMenu(); audio.play('click'); });
  });
  $('#btn-start').addEventListener('click', function () { audio.play('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { audio.play('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { audio.play('click'); openRecords(slangen.get('boardSize')); });
  $('#btn-om').addEventListener('click', function () { audio.play('click'); show('om'); });
  $('#btn-om-back').addEventListener('click', function () { audio.play('click'); show('menu'); });

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
    b.addEventListener('click', function () { audio.play('click'); toggleFullscreen(); });
  });
  document.addEventListener('fullscreenchange', function () { syncFullscreen(); layoutGame(); });
  document.addEventListener('webkitfullscreenchange', function () { syncFullscreen(); layoutGame(); });

  // ---------- Spillet ----------
  var game = null, paused = false, boardCanvas = $('#board');
  var DIR_NAMES = { up: 'op', down: 'ned', left: 'venstre', right: 'højre' };

  function startGame() {
    game = SlangenGame.createGame(slangen.get('boardSize'));
    paused = false;
    $('#pause-overlay').hidden = true;
    show('game');
    updateHud();
    drawBoard();
  }
  function drawBoard() {
    if (!game) return;
    SlangenRender.draw(boardCanvas, game.state, colors, { crash: game.state.over });
  }
  function updateHud() {
    var s = game.state;
    $('#hud-score').textContent = s.score;
    $('#hud-length').textContent = 'Længde ' + s.snake.length;
    $('#hud-best').textContent = Math.max(records.best(s.size), 0);
    $('#hud-size').textContent = s.size + ' × ' + s.size;
    var hb = $('#hud-bonus');
    if (s.bonus) {
      hb.classList.add('active');
      $('#hud-bonus-moves').textContent = s.bonus.movesLeft;
      $('#hud-bonus-text').textContent = s.bonus.movesLeft === 1 ? 'træk tilbage' : 'træk tilbage';
    } else {
      hb.classList.remove('active');
      $('#hud-bonus-moves').textContent = '–';
      $('#hud-bonus-text').textContent = 'ingen lige nu';
    }
    $$('.arrow').forEach(function (b) {
      var ok = game.canMove(b.dataset.dir);
      b.disabled = !ok;
      b.setAttribute('aria-label', (ok ? 'Flyt ' : 'Kan ikke flytte ') + DIR_NAMES[b.dataset.dir]);
    });
  }
  function move(dir) {
    if (!game || paused || current !== 'game' || game.state.over) return;
    var res = game.step(dir);
    if (res.ignored) return;
    var ev = res.events;
    if (ev.indexOf('dead') >= 0) audio.play('crash');
    else if (ev.indexOf('bonus') >= 0) audio.play('bonus');
    else if (ev.indexOf('eat') >= 0) audio.play('eat');
    else if (ev.indexOf('bonusGone') >= 0) audio.play('bonusGone');
    else audio.play('move');
    if (ev.indexOf('obstacle') >= 0) audio.play('obstacle');
    if (ev.indexOf('bonusSpawn') >= 0) audio.play('bonusSpawn');
    updateHud();
    drawBoard();
    if (game.state.over) gameOver();
  }
  $$('.arrow').forEach(function (b) {
    b.addEventListener('click', function () { move(b.dataset.dir); });
  });

  function setPaused(p) {
    if (!game || game.state.over) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    dwell.reset();
    audio.play('pause');
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { audio.play('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { audio.play('click'); game = null; paused = false; $('#pause-overlay').hidden = true; syncMenu(); show('menu'); });

  // ---------- Game over ----------
  var REASONS = {
    wall: 'Slangen ramte væggen.',
    self: 'Slangen ramte sig selv.',
    obstacle: 'Slangen ramte en forhindring.',
    full: 'Brættet er fyldt – flot klaret!'
  };
  var lastEntryId = null;
  function gameOver() {
    var s = game.state;
    var rankText = '';
    lastEntryId = null;
    if (s.score > 0) {
      var res = records.add(String(s.size), s.score);
      if (res.rank === 1) { rankText = 'Ny rekord!'; audio.play('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = REASONS[s.reason] || '';
    $('#go-score').textContent = s.score;
    $('#go-rank').textContent = rankText;
    $('#go-again-size').textContent = s.size + ' × ' + s.size;
    $('#go-records-title').textContent = 'Rekorder – ' + s.size + ' × ' + s.size;
    renderRecordList($('#go-records'), s.size, lastEntryId);
    show('gameover');
  }
  $('#btn-again').addEventListener('click', function () { audio.play('click'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { audio.play('click'); game = null; syncMenu(); show('menu'); });

  function renderRecordList(ol, size, highlightId) {
    var list = records.list(String(size));
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        li.querySelector('.score').textContent = e.score + ' point';
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder ----------
  var recSize = 15;
  function openRecords(size) { recSize = size; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.recSize) === recSize)); });
    $('#rec-title').textContent = 'Rekorder – ' + recSize + ' × ' + recSize;
    renderRecordList($('#rec-list'), recSize, null);
  }
  $$('#records [data-rec-size]').forEach(function (b) {
    b.addEventListener('click', function () { audio.play('click'); recSize = Number(b.dataset.recSize); syncRecords(); });
  });
  $('#btn-records-back').addEventListener('click', function () { audio.play('click'); show('menu'); });

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
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
  }
  $$('#settings [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { audio.play('click'); settingsTab = b.dataset.tab; syncSettingsUi(); });
  });
  $$('#settings [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, val = b.dataset.value;
      arkade.set(key, (val === 'true' || val === 'false') ? val === 'true' : val);
      audio.play('click');
      syncSettingsUi();
    });
  });
  function stepDwell(delta) {
    var v = Math.round((arkade.get('dwellTime') + delta) * 100) / 100;
    v = Math.min(3, Math.max(0.5, v));
    arkade.set('dwellTime', v);
    audio.play('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    audio.play('click');
    if (settingsReturn === 'game' && game) { show('game'); drawBoard(); $('#pause-overlay').hidden = false; }
    else { syncMenu(); show('menu'); }
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', function (e) {
    if (current === 'game') {
      if (KEYS[e.key]) {
        e.preventDefault();
        if (!e.repeat) move(KEYS[e.key]);
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPaused(!paused);
      }
    } else if (KEYS[e.key]) {
      e.preventDefault();
    }
  });

  // ---------- Layout af spilleskærmen ----------
  function layoutGame() {
    if (current !== 'game') return;
    var pauseBtn = $('#btn-pause');
    var btn = pauseBtn.offsetWidth || 120;
    var W = window.innerWidth, H = window.innerHeight;
    var pad = Math.max(10, Math.min(W, H) * 0.016);
    var gap = Math.max(19, Math.min(W, H) * 0.025);   // mindst ca. 0,5 cm
    var side = Math.max(btn, 150);
    var board = Math.floor(Math.min(W - 2 * pad - 2 * side - 2 * gap, H - 2 * pad - 2 * btn - 2 * gap));
    board = Math.max(160, board);
    var grid = $('#game-grid');
    grid.style.setProperty('--board', board + 'px');
    grid.style.setProperty('--game-gap', gap + 'px');
    grid.style.setProperty('--arrow-long', Math.max(btn, Math.min(board * 0.75, btn * 2.4)) + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.round(board * dpr);
    boardCanvas.height = Math.round(board * dpr);
    drawBoard();
  }
  window.addEventListener('resize', layoutGame);

  // ---------- Start ----------
  applyTheme();
  applyBackground();
  applyAnimation();
  syncMenu();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Slangen = {
    get game() { return game; }, settings: arkade, gameSettings: slangen, records: records,
    dwell: dwell, audio: audio, move: move, start: startGame, show: show
  };
})();
