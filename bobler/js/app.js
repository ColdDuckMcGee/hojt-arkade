/*
 * Bobler – brugerflade: skærme, sigte, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Bomberne og Labyrinten.
 */
(function () {
  'use strict';
  /* LUFT: mindst 24 px mellem knapper med forskellig betydning – en øjenstyring rammer inden for ca. 20–40 px */
  var LUFT = 24;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.BoblerGame, R = window.BoblerRender;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var bset = ArkadeSettings.create('bobler', { diff: '5', smallStep: 2 });
  var records = ArkadeHighscores.create('bobler', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  var STEPS = [1, 2, 5], BIG_STEP = 10;
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.DIFFS[bset.get('diff')]) bset.set('diff', '5');
  if (STEPS.indexOf(bset.get('smallStep')) < 0) bset.set('smallStep', 2);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Drejeknapperne må gentage sig med dwell (data-dwell-repeat). Skyd, Byt og
  // Fortryd må aldrig: dwell-modulet slipper sin lås, når en knap er deaktiveret
  // et øjeblik (fx mens boblen flyver). Derfor holder spillet sin egen lås:
  // samme knap kan først dwelles igen, når blikket har forladt den.
  var gazeLock = null, suppress = null;
  var dwell = ArkadeDwell.create({
    enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000,
    onActivate: function (el) {
      if (!el.classList.contains('once-btn')) return;
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
  // Lydene kommer fra det fælles lydmodul. Bobler bruger disse navne:
  var SFX = {
    turn: 'click', shoot: 'move', bounce: 'click', land: 'obstacle', pop: 'eat', fall: 'bonusSpawn',
    ceiling: 'bonusGone', cleared: 'bonus', over: 'crash', record: 'record', click: 'click', pause: 'pause',
    swap: 'click', undo: 'bonusGone'
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
    var v = function (n) { return cssVar('--bo-' + n); };
    var c = [], c2 = [];
    for (var i = 0; i < G.COLORS.length; i++) { c.push(v('c' + i)); c2.push(v('l' + i)); }
    colors = {
      floor: v('floor'), c: c, c2: c2, sym: v('sym'), rim: v('rim'), aim: v('aim'),
      ceiling: v('ceiling'), ceilingFill: v('ceiling-fill'), dead: v('dead'),
      cannon: v('cannon'), cannonFill: v('cannon-fill'), label: v('label'),
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
      : 'Bevægelse i baggrunden og boblens flugt. Fra giver en rolig fade';
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
  bset.onChange(function (key) { if (key === 'smallStep') { syncSettingsUi(); syncStepLabels(); } });

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
  function diffName(id) { return G.DIFFS[id].name + ' · ' + G.DIFFS[id].label; }
  function colorsText(n) { return n + ' farver'; }
  function levelsText(n) { return n === 1 ? '1 bane klaret' : n + ' baner klaret'; }
  function shotsText(n) { return n === 1 ? '1 skud' : n + ' skud'; }
  function bubbleName(i) { return G.COLORS[i].name + ' ' + G.COLORS[i].shape; }

  // ---------- Startmenu ----------
  function syncMenu() {
    var d = bset.get('diff');
    $$('#menu [data-diff]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.diff === d)); });
    $('#start-sub').textContent = diffName(d);
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-diff]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('diff', b.dataset.diff); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(bset.get('diff')); });
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
  var angle = 0;                 // grader fra lodret; negativ = venstre
  var display = null;            // brættet, som det så ud før skuddet (mens boblen flyver)
  var boardCanvas = $('#board');
  var fx = [], raf = 0, timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(bset.get('diff'));
    paused = false; busy = false; finished = false; fx = []; display = null; angle = 0;
    clearTimers();
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#bottom-overlay', '#clear-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function live() { return !!run && !busy && !paused && run.playable() && !overlayOpen() && current === 'game'; }

  function drawBoard(now) {
    if (!run || current !== 'game') return;
    var s = display || run.state;
    var flying = fx.some(function (f) { return f.kind === 'fly'; });
    R.draw(boardCanvas, s, colors, {
      angle: angle, aim: live() ? run.aim(angle) : null, showAim: live(),
      shotsToCeiling: G.RULES.ceilingEvery - s.misses,
      flying: flying, fx: fx, now: now || performance.now(), calm: !animationOn()
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

  function syncStepLabels() {
    var small = bset.get('smallStep');
    $$('.js-small').forEach(function (e) { e.textContent = small + '°'; });
    $$('.js-big').forEach(function (e) { e.textContent = BIG_STEP + '°'; });
    $('.aim-small-left').setAttribute('aria-label', 'Drej ' + small + ' grader til venstre');
    $('.aim-small-right').setAttribute('aria-label', 'Drej ' + small + ' grader til højre');
    $('.aim-big-left').setAttribute('aria-label', 'Drej ' + BIG_STEP + ' grader til venstre');
    $('.aim-big-right').setAttribute('aria-label', 'Drej ' + BIG_STEP + ' grader til højre');
  }

  function refresh() {
    if (!run) return;
    var s = display || run.state;
    $('#hud-level').textContent = s.level;
    $('#hud-colors').textContent = colorsText(s.colors);
    $('#hud-score').textContent = s.score;
    var left = G.RULES.ceilingEvery - s.misses;
    $('#hud-ceiling').textContent = left;
    $('#hud-ceiling-unit').textContent = left === 1 ? ' skud' : ' skud';
    var pips = $('#hud-pips');
    pips.innerHTML = '';
    for (var i = 0; i < G.RULES.ceilingEvery; i++) pips.insertAdjacentHTML('beforeend', '<span class="pip' + (i < left ? ' on' : '') + '"></span>');
    var ok = live();
    $$('[data-turn]').forEach(function (b) {
      var neg = b.dataset.turn.charAt(0) === '-';
      var atLimit = neg ? angle <= -G.MAX_ANGLE + 1e-9 : angle >= G.MAX_ANGLE - 1e-9;
      b.disabled = !ok || atLimit;
    });
    $('#btn-shoot').disabled = !ok;
    $('#btn-swap').disabled = !ok || s.current === s.next;
    var canUndo = !!run && run.canUndo() && !busy && !paused && current === 'game' && $('#clear-overlay').hidden && $('#pause-overlay').hidden;
    $('#btn-undo').disabled = !canUndo || !$('#bottom-overlay').hidden;
    $('#undo-sub').textContent = s.undoLeft > 0 ? '1 gang' : 'brugt';
    $('#btn-undo').setAttribute('aria-label', s.undoLeft > 0 ? 'Fortryd sidste skud (1 gang på banen)' : 'Fortryd er brugt på denne bane');
    boardCanvas.setAttribute('aria-label', boardLabel(s));
    drawBoard();
  }
  function boardLabel(s) {
    var txt = 'Spillebræt. Bane ' + s.level + '. ' + G.count(s.grid) + ' bobler. Sigte ' + Math.round(Math.abs(angle)) + ' grader ' +
      (angle < 0 ? 'til venstre' : angle > 0 ? 'til højre' : 'lige op') + '. Boblen er ' + bubbleName(s.current) + ', næste er ' + bubbleName(s.next) + '.';
    return txt + ' Loftet rykker om ' + shotsText(G.RULES.ceilingEvery - s.misses) + '.';
  }

  // ---------- Sigte ----------
  function setAngle(a, quiet) {
    var na = G.clampAngle(Math.round(a * 10) / 10);
    if (na === angle) return;
    angle = na;
    if (!quiet) sfx('turn');
    refresh();
  }
  function turn(kind) {
    if (!live()) return;
    var neg = kind.charAt(0) === '-', big = kind.replace('-', '') === 'big';
    var d = big ? BIG_STEP : bset.get('smallStep');
    setAngle(angle + (neg ? -d : d));
  }
  $$('[data-turn]').forEach(function (b) { b.addEventListener('click', function () { turn(b.dataset.turn); }); });
  // Klik på brættet sigter derhen (det skyder ikke)
  boardCanvas.addEventListener('click', function (e) {
    if (!live()) return;
    var r = boardCanvas.getBoundingClientRect(), bw = boardCanvas.clientLeft;
    var p = R.toBoard(boardCanvas, e.clientX - r.left - bw, e.clientY - r.top - boardCanvas.clientTop);
    var dx = p.x - G.W / 2, dy = G.SHOOT_Y - p.y;
    if (dy < 0.3) return;
    setAngle(Math.atan2(dx, dy) * 180 / Math.PI);
  });

  // ---------- Skud ----------
  function shoot() {
    if (!live()) return;
    var before = clone(run.state);
    var ev = run.shoot(angle);
    if (ev.ignored) return;
    busy = true;
    sfx('shoot');
    var calm = !animationOn();
    var now = performance.now();
    if (!calm) {
      var path = ev.trace.path, len = R.pathLength(path);
      var dur = Math.max(260, Math.min(950, len * 70));
      display = before;
      fx.push({ kind: 'fly', path: path, len: len, color: ev.color, t0: now, dur: dur });
      R.bounceDistances(path).forEach(function (d) { later(function () { sfx('bounce'); }, dur * d / len); });
      refresh();
      animate();
      later(function () { land(ev); }, dur);
    } else {
      land(ev);
    }
  }
  function land(ev) {
    display = null;
    var calm = !animationOn(), now = performance.now(), s = run.state, e = ev.events;
    fx = fx.filter(function (f) { return f.kind !== 'fly'; });
    var wait = 0;
    if (ev.popped.length) {
      sfx('pop');
      fx.push({ kind: 'pop', items: ev.popped, ceiling: s.ceiling, t0: now, dur: calm ? 350 : 420 });
      wait = calm ? 350 : 420;
    } else sfx('land');
    if (ev.fallen.length) {
      later(function () { sfx('fall'); }, calm ? 0 : 120);
      fx.push({ kind: 'fall', items: ev.fallen, ceiling: s.ceiling, t0: now, dur: calm ? 450 : 750 });
      wait = calm ? 450 : 750;
    }
    if (e.indexOf('ceiling') >= 0) { sfx('ceiling'); say('Loftet rykkede en række ned.'); }
    else if (ev.points) say('+' + ev.points + ' point.' + (e.indexOf('ceilingReset') >= 0 ? ' Loftets nedtælling starter forfra.' : ''));
    refresh();
    if (fx.length) animate();
    if (e.indexOf('cleared') >= 0) {
      later(function () { busy = false; sfx('cleared'); levelCleared(ev); }, wait + 150);
      return;
    }
    if (e.indexOf('over') >= 0) {
      later(function () { busy = false; sfx('over'); showBottom(); }, wait + 250);
      return;
    }
    if (wait && !calm) later(function () { busy = false; refresh(); }, Math.min(wait, 300));
    else { busy = false; refresh(); }
  }
  function say(t) { $('#board-status').textContent = t; }
  $('#btn-shoot').addEventListener('click', function () { if (!swallowed(this)) shoot(); });
  $('#btn-swap').addEventListener('click', function () { if (!swallowed(this)) swap(); });
  $('#btn-undo').addEventListener('click', function () { if (!swallowed(this)) undo(); });

  function swap() {
    if (!live() || run.state.current === run.state.next) return;
    if (!run.swap()) return;
    sfx('swap');
    refresh();
  }
  function undo() {
    if (!run || busy || paused || current !== 'game' || !$('#clear-overlay').hidden) return;
    if (!run.undo()) return;
    sfx('undo');
    fx = []; display = null;
    $('#bottom-overlay').hidden = true;
    dwell.reset();
    refresh();
  }

  function showBottom() {
    var s = run.state;
    $('#bottom-text').textContent = run.canUndo()
      ? 'Spillet er slut. Du kan fortryde det sidste skud og prøve en anden vinkel.'
      : 'Spillet er slut på bane ' + s.level + '.';
    $('#btn-bottom-undo').hidden = !run.canUndo();
    $('#bottom-overlay').hidden = false;
    fitScreen($('#bottom-overlay'));
    refresh();
    dwell.reset();
    $('#btn-result').focus({ preventScroll: true });
  }
  $('#btn-result').addEventListener('click', function () { if (!run) return; sfx('click'); $('#bottom-overlay').hidden = true; gameOver(); });
  $('#btn-bottom-undo').addEventListener('click', function () { undo(); });

  function levelCleared(ev) {
    var s = run.state;
    $('#clear-title').textContent = 'Bane ' + s.level + ' er ryddet!';
    $('#clear-bonus').textContent = '+' + ev.bonus + ' point i bonus';
    var nc = G.colorsFor(s.diff, s.level + 1);
    $('#clear-next').textContent = nc > s.colors ? 'Næste bane har ' + colorsText(nc) + ' – én mere end nu.' : 'Næste bane har ' + colorsText(nc) + ' og flere rækker.';
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
    fx = []; display = null; angle = 0;
    $('#clear-overlay').hidden = true;
    refresh();
  });

  function setPaused(p) {
    if (!run || run.state.over || busy || !$('#clear-overlay').hidden || !$('#bottom-overlay').hidden) return;
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
  $('#btn-quit').addEventListener('click', function () {
    sfx('click');
    // Spørg først: ét blik eller klik må aldrig smide et spil i gang væk (arkade/bekraeft.js)
    ArkadeBekraeft.spoerg({ onJa: function () { quitToMenu(); } });
  });
  function quitToMenu() { run = null; paused = false; busy = false; fx = []; display = null; clearTimers(); hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished) return;
    finished = true;
    var s = run.state;
    var cat = s.diff;
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
    $('#go-reason').textContent = 'Boblerne nåede bunden på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = 'Du nåede bane ' + s.level + ' · ' + levelsText(s.levelsCleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = diffName(s.diff);
    $('#go-records-title').textContent = 'Rekorder – ' + diffName(s.diff);
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
  var recDiff = '5';
  function openRecords(d) { recDiff = d; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-diff]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recDiff === recDiff)); });
    $('#rec-title').textContent = 'Rekorder – ' + diffName(recDiff);
    renderRecordList($('#rec-list'), recDiff, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-diff]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recDiff = b.dataset.recDiff; syncRecords(); });
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
    b.addEventListener('click', function () { bset.set(b.dataset.bset, Number(b.dataset.value)); sfx('click'); syncSettingsUi(); });
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
  // ←/→ drejer lidt (med Shift meget), mellemrum/Enter skyder, B/↑ bytter,
  // Z/Backspace fortryder og Esc/P giver pause.
  function gameKey(e) {
    if (e.key === 'ArrowLeft') return e.shiftKey ? '-big' : '-small';
    if (e.key === 'ArrowRight') return e.shiftKey ? 'big' : 'small';
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ' || k === 'Enter') return 'shoot';
    if (k === 'b' || k === 'ArrowUp') return 'swap';
    if (k === 'z' || k === 'Backspace') return 'undo';
    return null;
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) {
      // Fortryd virker også fra "bunden er nået"-boksen
      if (!$('#bottom-overlay').hidden && (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace')) { e.preventDefault(); undo(); }
      return; // ellers: Enter og mellemrum virker på den fokuserede knap
    }
    var a = gameKey(e);
    if (!a) return;
    e.preventDefault();
    var isTurn = a === 'small' || a === 'big' || a === '-small' || a === '-big';
    if (e.repeat && !isTurn) return; // én tast = ét skud; drej må gentage sig
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (isTurn) turn(a);
    else if (a === 'shoot') shoot();
    else if (a === 'swap') swap();
    else if (a === 'undo') undo();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Er vinduet for lille, skifter layoutet, og knapperne bliver så store som muligt.
  var FRAME = 6;              // brættets ramme i alt (2 × 3 px)
  var LAYOUTS = ['wide', 'below', 'side'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  function ctlGap(b) { return Math.round(Math.max(LUFT, Math.min(32, b * 0.2))); }

  // Boblestørrelse (px pr. boble) for hvert layout ved knapstørrelse b. meas = målte højder.
  function candidates(b, W, H, meas) {
    meas = meas || {};
    var d = spacing(W, H), p = d.p, g = d.g, cg = ctlGap(b);
    function unit(aw, ah) { return Math.floor(Math.min((aw - FRAME) / G.W, (ah - FRAME) / G.H) * 10) / 10; }
    var sideW = Math.min(360, Math.max(220, b * 1.9));
    var ctlW = 2 * b + cg;
    var hud = meas.hud || Math.max(SMALL_MIN, Math.min(96, b * 0.62));
    var ctl4W = 4 * b + 3 * cg, ctl2H = meas.act || 2 * b + cg;
    var res = {};
    var wideH = meas.wideH || Math.max(4 * b + 3 * cg, 0);
    res.wide = (H - 2 * p >= wideH) ? unit(W - 2 * p - sideW - ctlW - 2 * g, H - 2 * p) : 0;
    res.below = (ctl4W <= W - 2 * p) ? unit(W - 2 * p, H - 2 * p - hud - ctl2H - 2 * g) : 0;
    res.side = (hud + ctl2H + g <= H - 2 * p) ? unit(W - 2 * p - g - Math.max(ctl4W, meas.hudW || 0), H - 2 * p) : 0;
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 14)) res[l] = 0; });
    res.sideW = sideW; res.ctlW = ctlW; res.p = p; res.g = g; res.cg = cg;
    return res;
  }
  function pick(res) {
    var best = null;
    // Ved næsten samme størrelse foretrækkes det brede layout (mere luft omkring knapperne)
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    return best;
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, u, res) {
    var bw = Math.round(G.W * u) + FRAME, bh = Math.round(G.H * u) + FRAME;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(innerWidth, innerHeight) * Math.min(1, b / cssBtn(innerWidth, innerHeight))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ctl-gap', res.cg + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--ctl-w', Math.floor(res.ctlW) + 'px');
    var hudH = Math.round(Math.max(48, Math.min(96, b * 0.62)));
    st.setProperty('--hud-h', hudH + 'px');
    st.setProperty('--pause-s', Math.max(SMALL_MIN, hudH) + 'px'); // pauseknappen er altid mindst SMALL_MIN
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.max(1, Math.round((bw - FRAME) * dpr));
    boardCanvas.height = Math.max(1, Math.round((bh - FRAME) * dpr));
  }
  function measurePanels(lay) {
    var L = $('.side-left'), Rr = $('.side-right');
    if (lay === 'below' || lay === 'side') return { hud: L.offsetHeight, act: Rr.offsetHeight, hudW: lay === 'side' ? L.scrollWidth : 0 };
    return { wideH: Math.max(L.offsetHeight, Rr.offsetHeight) };
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), lay, res, u;
    // Prøv først med knapper på mindst SMALL_MIN på små skærme; passer intet, så ned til 48 px.
    var floors = isSmall(v) ? [SMALL_MIN, 48] : [SMALL_MIN, 48];
    for (var f = 0; f < floors.length; f++) {
      var floor = floors[f], b = Math.max(floor, cssBtn(v.W, v.H)), ok = false;
      for (var k = 0; k < 20; k++) {
        res = candidates(b, v.W, v.H);
        lay = pick(res);
        if (!res[lay] && b > floor) { b = Math.max(floor, b * 0.93); continue; }
        u = Math.max(10, res[lay]);
        applyLayout(lay, b, u, res);
        // 2. gang med de målte panelstørrelser
        res = candidates(b, v.W, v.H, measurePanels(lay));
        u = Math.max(10, res[lay]);
        applyLayout(lay, b, u, res);
        if (res[lay] && !overflows(gameEl) && !overflows(root)) { ok = true; break; }
        if (b <= floor) break;
        b = Math.max(floor, b * 0.93);
      }
      if (ok) break;
    }
    gameEl.dataset.layout = lay;
    gameEl.dataset.unit = u;
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
    root.classList.toggle('bo-lille', small);
    root.classList.toggle('bo-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('bo-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('bo-tvaers')) {
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
  syncStepLabels();
  show('menu');

  // Til test og fejlfinding
  window.Bobler = {
    get run() { return run; }, get busy() { return busy; }, get angle() { return angle; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, shoot: shoot, swap: swap, undo: undo, turn: turn, setAngle: setAngle,
    refresh: refresh, gameOver: gameOver, layoutGame: layoutGame, showBottom: showBottom, levelCleared: levelCleared
  };
})();
