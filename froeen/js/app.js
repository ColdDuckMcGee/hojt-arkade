/*
 * Frøen – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ og samme skabelon som Bomberne.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.FroeenGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var bset = ArkadeSettings.create('froeen', { lives: '3', preview: true });
  var records = ArkadeHighscores.create('froeen', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.MODES[bset.get('lives')]) bset.set('lives', '3');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Hvert dwell er præcis ét træk. Dwell-modulet slipper sin lås, hvis knappen
  // bliver deaktiveret et øjeblik (fx en pil mod en mur). Derfor holder spillet
  // sin egen lås: samme knap kan først dwelles igen, når blikket har forladt den.
  var gazeLock = null, suppress = null;
  var dwell = ArkadeDwell.create({
    enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000,
    onActivate: function (el) {
      if (!el.classList.contains('turn-btn')) return;
      if (el === gazeLock) suppress = el; else gazeLock = el;
    }
  });
  document.addEventListener('pointermove', function (e) {
    if (!gazeLock) return;
    var r = gazeLock.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) gazeLock = null;
  }, { passive: true });
  function swallowed(el) { if (suppress === el) { suppress = null; return true; } return false; }
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul. Frøen bruger disse navne:
  var SFX = {
    hop: 'move', wait: 'click', splash: 'obstacle', car: 'crash', edge: 'obstacle', hole: 'eat',
    lifeLost: 'bonusGone', cleared: 'bonus', record: 'record', click: 'click', pause: 'pause'
  };
  function sfx(name) { audio.play(SFX[name] || name); }

  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true); // TD Browse m.fl. kan klikke uden pointerdown
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  var colors = {};
  function readColors() {
    var v = function (n) { return cssVar('--fr-' + n); };
    colors = {
      top: v('top'), wall: v('wall'), wallFill: v('wall-fill'), hole: v('hole'), holeFill: v('hole-fill'), holeGlow: v('hole-glow'),
      water: v('water'), waterLine: v('water-line'), road: v('road'), roadLine: v('road-line'), safe: v('safe'), safeEdge: v('safe-edge'),
      frog: v('frog'), frogFill: v('frog-fill'),
      cars: [v('car1'), v('car2'), v('car3'), v('car4'), v('car5')], carFill: v('car-fill'), lights: v('lights'),
      log: v('log'), logLight: v('log-light'), logDark: v('log-dark'), turtle: v('turtle'), turtleFill: v('turtle-fill'),
      ghostCar: v('ghost-car'), ghostLog: v('ghost-log'), ghostAlpha: parseFloat(v('ghost-alpha')) || 0.5,
      splash: v('splash'), danger: v('danger'),
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
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og effekterne. Fra giver en rolig fade';
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
  bset.onChange(function (key) { if (key === 'preview') { syncSettingsUi(); refresh(); } });

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
  function modeName(id) { return G.MODES[id].name; }
  function levelsText(n) { return n === 1 ? '1 bane klaret' : n + ' baner klaret'; }
  function livesText(n) { return n === 1 ? '1 liv' : n + ' liv'; }

  // ---------- Startmenu ----------
  // Felterne er ikke knapper (man styrer med pilene), men de skal stadig være
  // store nok til at se tydeligt. Startskærmen siger til under ca. 1,2 cm.
  var MIN_CM = 1.2;
  function syncMenu() {
    var mode = bset.get('lives');
    $$('#menu [data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
    $('#start-sub').textContent = modeName(mode);
    var cm = cellSizeFor() / (96 / 2.54);
    $('#size-note').textContent = cm < MIN_CM
      ? 'På denne skærm bliver felterne ca. ' + cm.toFixed(1).replace('.', ',') + ' cm. Fuld skærm giver større felter.'
      : '';
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('lives', b.dataset.mode); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(bset.get('lives')); });
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
  var run = null, paused = false, busy = false, finished = false;
  var boardCanvas = $('#board');
  var fx = [], raf = 0, pendingTimer = 0;
  var DIR_NAMES = { up: 'op', down: 'ned', left: 'til venstre', right: 'til højre' };

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(bset.get('lives'));
    paused = false; busy = false; finished = false; fx = [];
    clearTimeout(pendingTimer);
    hideOverlays();
    show('game');
    refresh();
  }
  function hideOverlays() { ['#pause-overlay', '#death-overlay', '#clear-overlay'].forEach(function (o) { $(o).hidden = true; }); }
  function overlayOpen() { return !$('#pause-overlay').hidden || !$('#death-overlay').hidden || !$('#clear-overlay').hidden; }

  // Hvor står frøen efter næste træk, hvis den bliver stående på en stamme?
  function frogNext() {
    var s = run.state, lane = run.laneAt(s.frog.y);
    if (!lane || lane.kind === 'car' || !run.movesNext(lane)) return null;
    var nx = s.frog.x + lane.dir;
    return nx >= 0 && nx < s.cols ? { x: nx } : null;
  }
  function drawBoard(now) {
    if (!run || current !== 'game') return;
    var s = run.state, prev = bset.get('preview') && !s.dead && !s.cleared;
    FroeenRender.draw(boardCanvas, run, colors, {
      preview: prev, frogNext: prev ? frogNext() : null,
      waitDanger: prev && run.playable() && !!run.simulate('wait'),
      blockedUp: run.playable() && !!run.blocked('up'),
      fx: fx, now: now || performance.now(), calm: !animationOn()
    });
  }
  function animate() {
    if (raf) return;
    var step = function (now) {
      raf = 0;
      fx = fx.filter(function (f) { return now - f.t0 < f.dur; });
      drawBoard(now);
      if (fx.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-level').textContent = s.level;
    $('#hud-score').textContent = s.score;
    var filled = s.holes.filter(Boolean).length;
    $('#hud-holes').textContent = filled + '/' + s.holes.length;
    $('#hud-holes-row').innerHTML = s.holes.map(function (h) { return '<svg class="' + (h ? 'fyldt' : '') + '"><use href="#fr-hole"/></svg>'; }).join('');
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < s.lives; i++) h.insertAdjacentHTML('beforeend', '<svg class="heart" aria-hidden="true"><use href="#fr-heart"/></svg>');
    $('#hud-lives-num').textContent = s.lives;
    h.setAttribute('aria-label', s.lives === 1 ? '1 liv tilbage' : s.lives + ' liv tilbage');
    var live = !busy && !paused && run.playable() && !overlayOpen();
    $$('.arrow').forEach(function (b) {
      var ok = live && run.canMove(b.dataset.dir);
      b.disabled = !ok;
      var risk = ok && bset.get('preview') ? run.simulate(b.dataset.dir) : null;
      b.classList.toggle('risky', !!risk);
      b.setAttribute('aria-label', ok ? 'Hop ' + DIR_NAMES[b.dataset.dir] + (risk ? ' (farligt: ' + CAUSE_SHORT[risk] + ')' : '') : 'Kan ikke hoppe ' + DIR_NAMES[b.dataset.dir]);
    });
    // Pil op over muren eller et optaget hul: slået fra med en kort forklaring.
    var blockUp = live ? run.blocked('up') : null;
    var up = $('.arrow-up'), note = $('#up-note');
    up.classList.toggle('blocked', !!blockUp);
    note.hidden = !blockUp;
    note.textContent = blockUp ? BLOCKED[blockUp] : '';
    if (blockUp) up.setAttribute('aria-label', 'Kan ikke hoppe op. ' + BLOCKED[blockUp] + '.');
    var liveTxt = blockUp ? BLOCKED[blockUp] + '.' : '';
    if ($('#block-live').textContent !== liveTxt) $('#block-live').textContent = liveTxt;
    $('#btn-wait').disabled = !live;
    var waitRisk = live && bset.get('preview') ? run.simulate('wait') : null;
    $('#wait-sub').textContent = waitRisk ? 'farligt at stå stille' : 'stå stille ét træk';
    $('#btn-wait').classList.toggle('risky', !!waitRisk);
    boardCanvas.setAttribute('aria-label', boardLabel(s));
    drawBoard();
  }
  var CAUSE_SHORT = { bil: 'bil', vand: 'vand', kant: 'kanten' };
  var BLOCKED = { mur: 'Muren er i vejen', optaget: 'Hullet er optaget' };
  function boardLabel(s) {
    var txt = 'Spillebræt. Bane ' + s.level + '. ' + s.holes.filter(Boolean).length + ' af 5 huller fyldt. Frøen står i række ' + (s.rows - s.frog.y) + ' fra bunden, kolonne ' + (s.frog.x + 1) + '.';
    if (run.playable() && run.simulate('wait')) txt += ' Det er farligt at stå stille!';
    return txt;
  }

  // Én handling = ét træk. Intet sker mellem træk.
  function act(action) {
    if (!run || paused || busy || current !== 'game' || overlayOpen()) return;
    var before = { x: run.state.frog.x, y: run.state.frog.y };
    var ev = run.act(action);
    if (ev.ignored) return;
    var now = performance.now();
    var calm = !animationOn();
    var e = ev.events;
    if (e.indexOf('hole') >= 0) {
      sfx('hole');
      fx.push({ kind: 'hole', x: ev.holeX, y: 0, t0: now, dur: calm ? 600 : 900 });
    } else if (e.indexOf('hop') >= 0) sfx('hop');
    else sfx('wait');
    if (e.indexOf('cleared') >= 0) {
      sfx('cleared');
      refresh();
      animate();
      levelCleared(ev);
      return;
    }
    if (e.indexOf('died') >= 0) {
      busy = true;
      var f = run.state.frog, fxX = Math.max(0, Math.min(run.state.cols - 1, f.x));
      if (ev.cause === 'vand') { sfx('splash'); fx.push({ kind: 'splash', x: fxX, y: f.y, t0: now, dur: calm ? 600 : 900 }); }
      else { sfx(ev.cause === 'bil' ? 'car' : 'edge'); fx.push({ kind: 'hit', x: fxX, y: f.y, t0: now, dur: calm ? 600 : 800 }); }
      sfx('lifeLost');
      refresh();
      animate();
      // Kort pause, så man kan se, hvad der skete. Derefter venter spillet på et valg.
      pendingTimer = setTimeout(function () { busy = false; showDeath(); }, calm ? 650 : 900);
      return;
    }
    refresh();
    if (fx.length) animate();
  }
  $$('.arrow').forEach(function (b) { b.addEventListener('click', function () { if (!swallowed(b)) act(b.dataset.dir); }); });
  $('#btn-wait').addEventListener('click', function () { if (!swallowed(this)) act('wait'); });

  var CAUSES = {
    bil: 'En bil ramte frøen.', vand: 'Frøen faldt i vandet.', kant: 'Frøen blev ført ud over kanten.'
  };
  function showDeath() {
    var s = run.state;
    var last = s.over;
    $('#death-title').textContent = last ? 'Det sidste liv er brugt' : 'Du mistede et liv';
    $('#death-reason').textContent = (CAUSES[s.deathCause] || '') + (last ? '' : ' Du har ' + livesText(s.lives) + ' tilbage.');
    $('#btn-continue-label').textContent = last ? 'Se resultat' : 'Klar';
    $('#btn-continue-sub').textContent = last ? 'Spillet er slut' : 'Frøen starter i bunden igen';
    $('#death-overlay').hidden = false;
    fitScreen($('#death-overlay'));
    refresh();
    dwell.reset();
    $('#btn-continue').focus({ preventScroll: true });
  }
  $('#btn-continue').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    $('#death-overlay').hidden = true;
    if (run.state.over) { gameOver(); return; }
    run.respawn();
    fx = [];
    refresh();
  });

  function levelCleared(ev) {
    var s = run.state;
    $('#clear-title').textContent = 'Bane ' + s.level + ' er klaret!';
    $('#clear-bonus').textContent = '+' + ev.bonus + ' point i bonus';
    $('#clear-next').textContent = 'Alle fem huller er fyldt. Næste bane har flere og længere biler og kortere stammer.';
    $('#btn-next-sub').textContent = 'Bane ' + (s.level + 1);
    $('#clear-overlay').hidden = false;
    fitScreen($('#clear-overlay'));
    refresh();
    dwell.reset();
    $('#btn-next').focus({ preventScroll: true });
  }
  $('#btn-next').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    run.nextLevel();
    fx = [];
    $('#clear-overlay').hidden = true;
    refresh();
  });

  function setPaused(p) {
    if (!run || run.state.over || busy || !$('#clear-overlay').hidden || !$('#death-overlay').hidden) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); quitToMenu(); });
  function quitToMenu() { run = null; paused = false; busy = false; fx = []; clearTimeout(pendingTimer); hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished) return;
    finished = true;
    var s = run.state;
    var cat = s.modeId;
    var rankText = '';
    lastEntryId = null;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (s.score > 0) {
      var res = records.add(cat, s.score, { level: s.level });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = (CAUSES[s.deathCause] || '').replace(/\.$/, '') + ' på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = 'Du nåede bane ' + s.level + ' · ' + levelsText(s.levelsCleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = modeName(s.modeId);
    $('#go-records-title').textContent = 'Rekorder – ' + modeName(s.modeId).toLowerCase();
    renderRecordList($('#go-records'), cat, lastEntryId);
    show('gameover');
  }
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
        lv.textContent = ' · bane ' + (typeof e.level === 'number' ? e.level : 1);
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
  var recMode = '3';
  function openRecords(mode) { recMode = mode; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recMode === recMode)); });
    $('#rec-title').textContent = 'Rekorder – ' + modeName(recMode).toLowerCase();
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
    if (settingsReturn === 'game' && run) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  function gameKey(e) {
    if (KEYS[e.key]) return KEYS[e.key];
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'v' || k === 'Enter') return 'wait';
    return null;
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var a = gameKey(e);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return; // én tast = ét træk
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    act(a);
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Er vinduet for lille, skifter layoutet, og knapperne bliver så store som muligt.
  var FRAME = 6;              // brættets ramme i alt (2 × 3 px)
  var AROUND_MIN = 56;        // pile rundt om brættet, hvis felterne bliver mindst ca. 1,5 cm
  var LAYOUTS = ['wide', 'tall', 'below', 'side'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }

  // Feltstørrelse for hvert layout ved knapstørrelse b. meas = målte panelhøjder.
  function candidates(b, W, H, meas) {
    meas = meas || {};
    var ic = G.COLS, ir = G.ROWS, d = spacing(W, H), p = d.p, g = d.g;
    function cell(aw, ah) { return Math.floor(Math.min((aw - FRAME) / ic, (ah - FRAME) / ir)); }
    var sideW = Math.min(380, Math.max(220, b * 1.9));
    var hud = meas.hud || Math.max(48, Math.min(96, b * 0.62));
    var act = meas.act || b;
    var tallPanels = meas.tall || (hud + act + g);
    var res = {};
    res.wide = (H - 2 * p >= 3.4 * b + 2 * g) ? cell(W - 2 * p - 2 * sideW - 2 * b - 4 * g, H - 2 * p - 2 * b - 2 * g) : 0;
    res.tall = cell(W - 2 * p - 2 * b - 2 * g, H - 2 * p - 2 * b - tallPanels - 4 * g);
    res.below = (3 * b + 2 * g <= W - 2 * p) ? cell(W - 2 * p, H - 2 * p - hud - 2 * b - act - 4 * g) : 0;
    res.side = (hud + 2 * b + act + 3 * g <= H - 2 * p) ? cell(W - 2 * p - g - (3 * b + 2 * g), H - 2 * p) : 0;
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; }); // under 16 px: kan ikke bruges
    res.sideW = sideW; res.p = p; res.g = g;
    return res;
  }
  function pick(res, not) {
    not = not || {};
    if (!not.wide && res.wide >= AROUND_MIN) return 'wide';
    if (!not.tall && res.tall >= AROUND_MIN) return 'tall';
    var best = null;
    LAYOUTS.forEach(function (l) { if (!not[l] && (best === null || res[l] > res[best])) best = l; });
    return best;
  }
  // Som pick, men pile rundt om brættet bruges kun, hvis felterne bliver store nok (som i layoutGame)
  function pickUsable(res) {
    var not = {}, lay = pick(res, not);
    for (var i = 0; i < 2 && (lay === 'wide' || lay === 'tall') && res[lay] < AROUND_MIN; i++) { not[lay] = true; lay = pick(res, not); }
    return lay;
  }
  // Omtrentlig feltstørrelse (til advarslen på startskærmen)
  function cellSizeFor() {
    var v = viewport(), floors = isSmall(v) ? [SMALL_MIN, 40] : [40];
    for (var f = 0; f < floors.length; f++) {
      var b = Math.max(floors[f], cssBtn(v.W, v.H));
      for (var k = 0; k < 16; k++) {
        var res = candidates(b, v.W, v.H), cell = res[pickUsable(res)];
        if (cell > 0) return cell;
        if (b <= floors[f]) break;
        b = Math.max(floors[f], b * 0.93);
      }
    }
    return 0;
  }


  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res) {
    var bw = G.COLS * cell + FRAME, bh = G.ROWS * cell + FRAME;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(innerWidth, innerHeight) * Math.min(1, b / cssBtn(innerWidth, innerHeight))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    var hudH = Math.round(Math.max(48, Math.min(96, b * 0.62)));
    st.setProperty('--hud-h', hudH + 'px');
    st.setProperty('--pause-s', Math.max(SMALL_MIN, hudH) + 'px'); // pauseknappen er altid mindst SMALL_MIN
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var long = (lay === 'wide' || lay === 'tall') ? Math.max(b, Math.min(Math.min(bw, bh) * 0.75, b * 2.4)) : b;
    st.setProperty('--arrow-long', long + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.max(1, Math.round((bw - FRAME) * dpr));
    boardCanvas.height = Math.max(1, Math.round((bh - FRAME) * dpr));
  }
  function measurePanels(lay, res) {
    var L = $('.side-left').offsetHeight, R = $('.side-right').offsetHeight;
    if (lay === 'tall') return { tall: L + R + res.g };
    if (lay === 'below' || lay === 'side') return { hud: L, act: R };
    return {};
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport();
    var lay, res, cell;
    // Prøv først med knapper på mindst SMALL_MIN på små skærme; passer intet, så ned til 40 px.
    var floors = isSmall(v) ? [SMALL_MIN, 40] : [40];
    for (var f = 0; f < floors.length; f++) {
      var floor = floors[f], b = Math.max(floor, cssBtn(v.W, v.H)), ok = false;
      for (var k = 0; k < 16; k++) {
        var not = {};
        for (var t = 0; t < 3; t++) {
          res = candidates(b, v.W, v.H);
          lay = pick(res, not);
          if (!res[lay] && b > floor) break;   // intet layout passer: mindre knapper
          cell = Math.max(12, res[lay]);
          applyLayout(lay, b, cell, res);
          // 2. gang med de målte panelhøjder
          res = candidates(b, v.W, v.H, measurePanels(lay, res));
          cell = Math.max(12, res[lay]);
          // Pile rundt om et bræt med for små felter er ikke det værd: prøv et andet layout
          if ((lay === 'wide' || lay === 'tall') && cell < AROUND_MIN) { not[lay] = true; continue; }
          break;
        }
        if (!res[lay] && b > floor) { b = Math.max(floor, b * 0.93); continue; }
        applyLayout(lay, b, cell, res);
        if (res[lay] && !overflows(gameEl) && !overflows(root)) { ok = true; break; }
        if (b <= floor) break;
        b = Math.max(floor, b * 0.93);
      }
      if (ok) break;
    }
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    drawBoard();
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('fr-lille', small);
    root.classList.toggle('fr-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('fr-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('fr-tvaers')) {
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
  syncSmall();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Froeen = {
    get run() { return run; }, get busy() { return busy; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, act: act, cellSizeFor: cellSizeFor, refresh: refresh,
    gameOver: gameOver
  };
})();
