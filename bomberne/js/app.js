/*
 * Bomberne – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Slangen og Minestryger.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.BomberneGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var bset = ArkadeSettings.create('bomberne', { boardSize: '11x9', enemyArrows: true });
  var records = ArkadeHighscores.create('bomberne', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.SIZES[bset.get('boardSize')]) bset.set('boardSize', '11x9');

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
  // Lydene kommer fra det fælles lydmodul. Bomberne bruger disse navne:
  var SFX = {
    step: 'move', bomb: 'obstacle', tick: 'click', boom: 'crash', enemy: 'eat', pickup: 'bonusSpawn',
    door: 'bonusSpawn', lifeLost: 'bonusGone', cleared: 'bonus', record: 'record', click: 'click', pause: 'pause', undo: 'bonusGone'
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
    var v = function (n) { return cssVar('--bb-' + n); };
    colors = {
      floor: v('floor'), grid: v('grid'), pillarFill: v('pillar-fill'), pillarEdge: v('pillar-edge'),
      crate: v('crate'), crateGlass1: v('crate-glass1'), crateGlass2: v('crate-glass2'), crateShine: v('crate-shine'),
      player: v('player'), playerFill: v('player-fill'),
      bomb: v('bomb'), bombFill: v('bomb-fill'), bombCore: v('bomb-core'), bombText: v('bomb-text'),
      fuse: v('fuse'), fuseTip: v('fuse-tip'),
      flame: v('flame'), flameCore: v('flame-core'), flameEdge: v('flame-edge'),
      danger: v('danger'),
      e_wander: v('e-wander'), e_chaser: v('e-chaser'), e_slow: v('e-slow'), enemyFill: v('enemy-fill'),
      arrowAlpha: parseFloat(v('arrow-alpha')) || 0.42,
      door: v('door'), doorFill: v('door-fill'), doorClosed: v('door-closed'),
      pickup: v('pickup'), pickupFill: v('pickup-fill'),
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
      : 'Bevægelse i baggrunden og eksplosionerne. Fra giver en rolig fade';
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
  bset.onChange(function (key) { if (key === 'enemyArrows') { syncSettingsUi(); drawBoard(); } });

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
  function sizeLabel(id) { return G.SIZES[id].label; }
  function sizeName(id) { return G.SIZES[id].name + ' ' + G.SIZES[id].label; }
  function levelsText(n) { return n === 1 ? '1 bane klaret' : n + ' baner klaret'; }
  function enemiesText(n) { return n === 1 ? '1 fjende' : n + ' fjender'; }

  // ---------- Startmenu ----------
  // Felterne er ikke knapper (man styrer med pilene), men de skal stadig være
  // store nok til at se tydeligt. Startskærmen siger til under ca. 1,8 cm.
  var MIN_CM = 1.8;
  function syncMenu() {
    var size = bset.get('boardSize');
    $$('#menu [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === size)); });
    var cm = cellSizeFor(size) / (96 / 2.54);
    $('#size-note').textContent = cm < MIN_CM
      ? 'På denne skærm bliver felterne ca. ' + cm.toFixed(1).replace('.', ',') + ' cm. Vælg et mindre bræt eller fuld skærm for større felter.'
      : '';
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('boardSize', b.dataset.size); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(bset.get('boardSize')); });
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
    run = G.createRun(bset.get('boardSize'));
    paused = false; busy = false; finished = false; fx = [];
    clearTimeout(pendingTimer);
    hideOverlays();
    show('game');
    refresh();
  }
  function hideOverlays() { ['#pause-overlay', '#death-overlay', '#clear-overlay'].forEach(function (o) { $(o).hidden = true; }); }
  function overlayOpen() { return !$('#pause-overlay').hidden || !$('#death-overlay').hidden || !$('#clear-overlay').hidden; }

  function drawBoard(now) {
    if (!run || current !== 'game') return;
    var s = run.state;
    BomberneRender.draw(boardCanvas, s, colors, {
      danger: run.danger(), arrows: bset.get('enemyArrows') && !s.dead,
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
    $('#hud-enemies').textContent = s.enemies.length;
    var door = $('#hud-door');
    door.textContent = s.enemies.length ? 'udgang lukket' : 'udgang åben';
    door.classList.toggle('open', !s.enemies.length);
    $('#hud-range').textContent = s.range;
    $('#hud-bombs').textContent = s.maxBombs;
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < s.lives; i++) h.insertAdjacentHTML('beforeend', '<svg class="heart" aria-hidden="true"><use href="#bb-heart"/></svg>');
    $('#hud-lives-num').textContent = s.lives;
    h.setAttribute('aria-label', s.lives === 1 ? '1 liv tilbage' : s.lives + ' liv tilbage');
    var live = !busy && !paused && run.playable() && !overlayOpen();
    $$('.arrow').forEach(function (b) {
      var ok = live && run.canMove(b.dataset.dir);
      b.disabled = !ok;
      var why = run.blockedBy(b.dataset.dir);
      b.setAttribute('aria-label', ok ? 'Gå ' + DIR_NAMES[b.dataset.dir] : 'Kan ikke gå ' + DIR_NAMES[b.dataset.dir] + (why ? ' (' + why + ')' : ''));
    });
    var placed = s.bombs.length;
    $('#btn-bomb').disabled = !(live && run.canBomb());
    $('#bomb-sub').textContent = placed >= s.maxBombs
      ? (s.maxBombs === 1 ? 'din bombe ligger ude' : 'alle ' + s.maxBombs + ' ligger ude')
      : (s.maxBombs === 1 ? '1 ad gangen' : (s.maxBombs - placed) + ' af ' + s.maxBombs + ' klar');
    $('#btn-wait').disabled = !live;
    var canUndo = run.canUndo() && !busy;
    $('#btn-undo').disabled = !(canUndo && live);
    $('#undo-sub').textContent = s.undoLeft > 0 ? '1 gang på banen' : 'brugt på denne bane';
    boardCanvas.setAttribute('aria-label', boardLabel(s));
    drawBoard();
  }
  function boardLabel(s) {
    var txt = 'Spillebræt. Bane ' + s.level + '. ' + enemiesText(s.enemies.length) + ' tilbage.';
    if (s.bombs.length) txt += ' Bomber: ' + s.bombs.map(function (b) { return b.timer; }).join(', ') + ' træk til de springer.';
    var d = run.danger();
    if (d[run.idx(s.player.x, s.player.y)] === 1) txt += ' Du står i flammens vej i næste træk!';
    return txt;
  }

  // Én handling = ét træk. Intet sker mellem træk.
  function act(action) {
    if (!run || paused || busy || current !== 'game' || overlayOpen()) return;
    var ev = run.act(action);
    if (ev.ignored) return;
    var now = performance.now();
    var calm = !animationOn();
    var e = ev.events;
    if (e.indexOf('cleared') >= 0) {
      sfx('step'); sfx('cleared');
      refresh();
      levelCleared(ev);
      return;
    }
    if (e.indexOf('explode') >= 0) {
      sfx('boom');
      fx.push({ kind: 'flame', cells: ev.flames, t0: now, dur: calm ? 600 : 750 });
      ev.crates.forEach(function (i) { fx.push({ kind: 'crate', i: i, t0: now, dur: calm ? 500 : 650 }); });
    } else if (e.indexOf('bomb') >= 0) sfx('bomb');
    else if (e.indexOf('step') >= 0) sfx('step');
    else if (e.indexOf('tick') >= 0) sfx('tick');
    ev.killed.forEach(function (k) { fx.push({ kind: 'enemy', e: k, t0: now, dur: calm ? 500 : 700 }); });
    if (ev.killed.length) sfx('enemy');
    if (ev.pickup) sfx('pickup');
    if (e.indexOf('doorOpen') >= 0) sfx('door');
    if (e.indexOf('died') >= 0) {
      busy = true;
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
  $('#btn-bomb').addEventListener('click', function () { if (!swallowed(this)) act('bomb'); });
  $('#btn-wait').addEventListener('click', function () { if (!swallowed(this)) act('wait'); });
  $('#btn-undo').addEventListener('click', function () { if (!swallowed(this)) undo(); });

  function undo() {
    if (!run || busy || paused || current !== 'game') return;
    if (!run.undo()) return;
    sfx('undo');
    fx = [];
    $('#death-overlay').hidden = true;
    dwell.reset();
    refresh();
  }

  var CAUSES = { flame: 'Flammen ramte dig.', enemy: 'En fjende fangede dig.' };
  function showDeath() {
    var s = run.state;
    var last = s.over;
    $('#death-title').textContent = last ? 'Det sidste liv er brugt' : 'Du mistede et liv';
    $('#death-reason').textContent = (CAUSES[s.deathCause] || '') + (last ? '' : ' Du har ' + (s.lives === 1 ? '1 liv' : s.lives + ' liv') + ' tilbage.');
    $('#btn-continue-label').textContent = last ? 'Se resultat' : 'Fortsæt';
    $('#btn-continue-sub').textContent = last ? 'Spillet er slut' : 'Du starter i hjørnet igen';
    $('#btn-death-undo').hidden = !run.canUndo();
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
  $('#btn-death-undo').addEventListener('click', function () { undo(); });

  function levelCleared(ev) {
    var s = run.state;
    $('#clear-title').textContent = 'Bane ' + s.level + ' er klaret!';
    $('#clear-bonus').textContent = '+' + ev.bonus + ' point i bonus';
    var next = G.enemiesFor(s.sizeId, s.level + 1);
    var extra = next.chaser ? ' – heraf ' + (next.chaser === 1 ? '1 jæger' : next.chaser + ' jægere') : '';
    $('#clear-next').textContent = 'Næste bane har ' + enemiesText(next.count) + extra + '.';
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
  $('#btn-quit').addEventListener('click', function () {
    sfx('click');
    // Spørg først: ét blik eller klik må aldrig smide et spil i gang væk (arkade/bekraeft.js)
    ArkadeBekraeft.spoerg({ onJa: function () { quitToMenu(); } });
  });
  function quitToMenu() { run = null; paused = false; busy = false; fx = []; clearTimeout(pendingTimer); hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished) return;
    finished = true;
    var s = run.state;
    var cat = s.sizeId;
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
    $('#go-reason').textContent = (s.deathCause === 'enemy' ? 'En fjende fangede dig' : 'Flammen ramte dig') + ' på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = 'Du nåede bane ' + s.level + ' · ' + levelsText(s.levelsCleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = sizeName(s.sizeId) + ' · tre liv';
    $('#go-records-title').textContent = 'Rekorder – ' + sizeName(s.sizeId);
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
  var recSize = '11x9';
  function openRecords(size) { recSize = size; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recSize === recSize)); });
    $('#rec-title').textContent = 'Rekorder – ' + sizeName(recSize);
    renderRecordList($('#rec-list'), recSize, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-size]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recSize = b.dataset.recSize; syncRecords(); });
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
    if (k === ' ' || k === 'b') return 'bomb';
    if (k === 'v' || k === 'Enter') return 'wait';
    if (k === 'z' || k === 'Backspace') return 'undo';
    return null;
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) {
      // Fortryd virker også fra "mistet liv"-boksen
      if (!$('#death-overlay').hidden && (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace')) { e.preventDefault(); undo(); }
      return; // ellers: Enter og mellemrum virker på den fokuserede knap
    }
    var a = gameKey(e);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return; // én tast = ét træk
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (a === 'undo') undo(); else act(a);
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
  function candidates(sizeId, b, W, H, meas) {
    meas = meas || {};
    var S = G.SIZES[sizeId], ic = S.cols - 2, ir = S.rows - 2, d = spacing(W, H), p = d.p, g = d.g;
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
  function cellSizeFor(sizeId) {
    var v = viewport(), floors = isSmall(v) ? [SMALL_MIN, 40] : [40];
    for (var f = 0; f < floors.length; f++) {
      var b = Math.max(floors[f], cssBtn(v.W, v.H));
      for (var k = 0; k < 16; k++) {
        var res = candidates(sizeId, b, v.W, v.H), cell = res[pickUsable(res)];
        if (cell > 0) return cell;
        if (b <= floors[f]) break;
        b = Math.max(floors[f], b * 0.93);
      }
    }
    return 0;
  }


  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res, sizeId) {
    var S = G.SIZES[sizeId];
    var bw = (S.cols - 2) * cell + FRAME, bh = (S.rows - 2) * cell + FRAME;
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
    var v = viewport(), sizeId = run.state.sizeId;
    var lay, res, cell;
    // Prøv først med knapper på mindst SMALL_MIN på små skærme; passer intet, så ned til 40 px.
    var floors = isSmall(v) ? [SMALL_MIN, 40] : [40];
    for (var f = 0; f < floors.length; f++) {
      var floor = floors[f], b = Math.max(floor, cssBtn(v.W, v.H)), ok = false;
      for (var k = 0; k < 16; k++) {
        var not = {};
        for (var t = 0; t < 3; t++) {
          res = candidates(sizeId, b, v.W, v.H);
          lay = pick(res, not);
          if (!res[lay] && b > floor) break;   // intet layout passer: mindre knapper
          cell = Math.max(12, res[lay]);
          applyLayout(lay, b, cell, res, sizeId);
          // 2. gang med de målte panelhøjder
          res = candidates(sizeId, b, v.W, v.H, measurePanels(lay, res));
          cell = Math.max(12, res[lay]);
          // Pile rundt om et bræt med for små felter er ikke det værd: prøv et andet layout
          if ((lay === 'wide' || lay === 'tall') && cell < AROUND_MIN) { not[lay] = true; continue; }
          break;
        }
        if (!res[lay] && b > floor) { b = Math.max(floor, b * 0.93); continue; }
        applyLayout(lay, b, cell, res, sizeId);
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
    root.classList.toggle('bb-lille', small);
    root.classList.toggle('bb-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('bb-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('bb-tvaers')) {
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
  window.Bomberne = {
    get run() { return run; }, get busy() { return busy; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, act: act, undo: undo, cellSizeFor: cellSizeFor, refresh: refresh,
    gameOver: gameOver
  };
})();
