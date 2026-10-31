/*
 * Minestryger – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Slangen.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.MinestrygerGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var mine = ArkadeSettings.create('minestryger', { boardSize: '8x8', lives: 3 });
  var records = ArkadeHighscores.create('minestryger', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.SIZES[mine.get('boardSize')]) mine.set('boardSize', '8x8');
  if ([1, 3].indexOf(mine.get('lives')) < 0) mine.set('lives', 3);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul. Minestryger bruger disse navne:
  var SFX = { open: 'move', area: 'eat', flag: 'bonusSpawn', unflag: 'bonusGone', boom: 'crash', rewind: 'obstacle', cleared: 'bonus', record: 'record', click: 'click', pause: 'pause' };
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
    root.classList.toggle('ms-calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og eksplosionen. Fra giver en rolig fade';
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
    if (id === 'menu') syncMenu();
    fitCurrent();
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function sizeLabel(id) { return G.SIZES[id].label; }
  function livesLabel(n) { return n === 1 ? 'ét liv' : 'tre liv'; }
  function category(lives, size) { return lives + 'liv-' + size; }
  function platesText(n) { return n === 1 ? '1 plade ryddet' : n + ' plader ryddet'; }

  // ---------- Startmenu ----------
  // Brætstørrelser: Et bræt kan kun vælges, hvis felterne på den aktuelle
  // skærm bliver mindst MIN_CELL_CM. Det mindste bræt kan altid vælges.
  // Den gemte præference ændres ikke, så det store bræt kommer igen på en
  // større skærm (eller når skærmen vendes).
  var SIZE_ORDER = ['6x6', '8x8', '10x8'];
  function sizeAllowed(id) { return id === SIZE_ORDER[0] || plan(id).vis >= MIN_CELL_PX; }
  function effectiveSize() {
    var want = mine.get('boardSize');
    if (sizeAllowed(want)) return want;
    for (var i = SIZE_ORDER.indexOf(want) - 1; i > 0; i--) if (sizeAllowed(SIZE_ORDER[i])) return SIZE_ORDER[i];
    return SIZE_ORDER[0];
  }
  function cmText(px) { return (px / CM).toFixed(1).replace('.', ',') + ' cm'; }
  function syncMenu() {
    var size = effectiveSize(), lives = mine.get('lives');
    var blocked = [];
    $$('#menu [data-size]').forEach(function (b) {
      var ok = sizeAllowed(b.dataset.size);
      if (ok) b.removeAttribute('aria-disabled'); else { b.setAttribute('aria-disabled', 'true'); blocked.push(b.querySelector('.big').textContent); }
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
    $$('#menu [data-lives]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.lives) === lives)); });
    var vis = plan(size).vis, note = '';
    if (blocked.length) {
      note = blocked.join(' og ') + ' kræver en større skærm: felterne ville blive under ' + cmText(MIN_CELL_PX) + '. ';
      if (window.innerWidth < window.innerHeight) note += 'Prøv at vende skærmen. ';
    }
    if (vis < 2.9 * CM) note += 'Her bliver felterne ca. ' + cmText(vis) + (blocked.length ? '.' : '. Vælg et mindre bræt eller fuld skærm for større felter.');
    $('#size-note').textContent = note.trim();
    if (current === 'menu') fitCurrent();
  }
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-disabled') === 'true') return;
      mine.set('boardSize', b.dataset.size); syncMenu(); sfx('click');
    });
  });
  $$('#menu [data-lives]').forEach(function (b) {
    b.addEventListener('click', function () { mine.set('lives', Number(b.dataset.lives)); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(mine.get('lives'), effectiveSize()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, mine].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
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
  function onFs() { syncFullscreen(); onResize(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  // run: hele spillet (flere plader). plate: den aktuelle plade.
  var run = null, plate = null, mode = 'open', paused = false;
  var board = MinestrygerBoard.create($('#board'), { onCell: onCell });

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = { size: effectiveSize(), maxLives: mine.get('lives'), lives: mine.get('lives'), score: 0, plateNo: 1, cleared: 0, over: false };
    paused = false;
    newPlate();
    show('game');
    board.focusCursor();
  }
  function newPlate() {
    plate = G.createPlate(run.size, run.plateNo);
    $('#pause-overlay').hidden = true;
    $('#clear-overlay').hidden = true;
    board.reset();
    board.build(plate.state);
    setMode('open', true);
    refresh();
  }
  function refresh() {
    if (!plate) return;
    board.update(plate.state, mode);
    $('#hud-plate').textContent = run.plateNo;
    var left = plate.minesLeft();
    $('#hud-mines').textContent = left;
    $('#hud-mines-sub').textContent = 'af ' + plate.state.mines + ' tilbage';
    $('#hud-score').textContent = run.score;
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < run.maxLives; i++) {
      h.insertAdjacentHTML('beforeend', '<svg class="heart' + (i < run.lives ? ' full' : '') + '" aria-hidden="true"><use href="#ms-heart"/></svg>');
    }
    h.setAttribute('aria-label', run.lives === 1 ? '1 liv tilbage' : run.lives + ' liv tilbage');
  }

  function setMode(m, silent) {
    mode = m;
    $('#board-wrap').dataset.mode = m;
    var btn = $('#btn-mode');
    btn.dataset.mode = m;
    btn.setAttribute('aria-label', m === 'open'
      ? 'Tilstand: Åbn felt. Vælg for at skifte til Sæt flag.'
      : 'Tilstand: Sæt flag. Vælg for at skifte til Åbn felt.');
    if (!silent) sfx('click');
    if (plate) board.update(plate.state, mode);
  }
  $('#btn-mode').addEventListener('click', function () { if (!board.busy) setMode(mode === 'open' ? 'flag' : 'open'); });

  function canPlay() { return run && plate && !run.over && !paused && current === 'game' && !board.busy && $('#clear-overlay').hidden; }

  function onCell(i) {
    if (!canPlay()) return;
    if (mode === 'flag') {
      var f = plate.toggleFlag(i);
      if (f.ignored) return;
      sfx(f.flag ? 'flag' : 'unflag');
      refresh();
      return;
    }
    var res = plate.open(i);
    if (res.ignored) return;
    if (res.hit) { hitMine(i); return; }
    run.score += res.points;
    sfx(res.opened.length > 1 ? 'area' : 'open');
    refresh();
    if (res.cleared) plateCleared();
  }

  function hitMine(i) {
    run.lives--;
    refresh();
    sfx('boom');
    var calm = !animationOn();
    var ex = board.explode(i, calm);
    if (run.lives > 0) {
      ex.done.then(function () { return wait(calm ? 300 : 550); }).then(function () {
        sfx('rewind');
        return ex.rewind();
      }).then(function () {
        refresh();
        board.focusCursor();
      });
    } else {
      run.over = true;
      ex.done.then(function () { return wait(calm ? 500 : 900); }).then(function () {
        ex.end();
        gameOver();
      });
    }
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function plateCleared() {
    var bonus = G.plateBonus(plate.state.mines);
    run.score += bonus;
    run.cleared++;
    refresh();
    sfx('cleared');
    $('#clear-title').textContent = 'Plade ' + run.plateNo + ' er ryddet!';
    $('#clear-bonus').textContent = '+' + bonus + ' point i bonus';
    var nextMines = G.minesFor(run.size, run.plateNo + 1);
    $('#clear-next').textContent = 'Næste plade har ' + nextMines + ' miner.';
    $('#btn-next-sub').textContent = 'Plade ' + (run.plateNo + 1);
    $('#clear-overlay').hidden = false;
    fitOverlays();
    dwell.reset();
    $('#btn-next').focus({ preventScroll: true });
  }
  $('#btn-next').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    run.plateNo++;
    newPlate();
    board.focusCursor();
  });

  function setPaused(p) {
    if (!run || run.over || board.busy || !$('#clear-overlay').hidden) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    fitOverlays();
    dwell.reset();
    sfx('pause');
    if (p) $('#btn-resume').focus({ preventScroll: true }); else board.focusCursor();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () {
    sfx('click');
    // Spørg først: ét blik eller klik må aldrig smide et spil i gang væk (arkade/bekraeft.js)
    ArkadeBekraeft.spoerg({ onJa: function () { quitToMenu(); } });
  });
  function quitToMenu() { run = null; plate = null; paused = false; board.reset(); $('#pause-overlay').hidden = true; show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    var cat = category(run.maxLives, run.size);
    var rankText = '';
    lastEntryId = null;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (run.score > 0) {
      var res = records.add(cat, run.score, { plates: run.cleared });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = 'Du ramte en mine på plade ' + run.plateNo + '.';
    $('#go-score').textContent = run.score;
    $('#go-plates').textContent = platesText(run.cleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = sizeLabel(run.size) + ' · ' + livesLabel(run.maxLives);
    $('#go-records-title').textContent = 'Rekorder – ' + sizeLabel(run.size) + ', ' + livesLabel(run.maxLives);
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
        var p = typeof e.plates === 'number' ? e.plates : 0;
        li.querySelector('.score').innerHTML = '';
        li.querySelector('.score').appendChild(document.createTextNode(e.score + ' point'));
        var pl = document.createElement('span'); pl.className = 'plates'; pl.textContent = ' · ' + (p === 1 ? '1 plade' : p + ' plader');
        li.querySelector('.score').appendChild(pl);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder ----------
  var recLives = 3, recSize = '8x8';
  function openRecords(lives, size) { recLives = lives; recSize = size; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recSize === recSize)); });
    $$('#records [data-rec-lives]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.recLives) === recLives)); });
    $('#rec-title').textContent = 'Rekorder – ' + sizeLabel(recSize) + ', ' + livesLabel(recLives);
    renderRecordList($('#rec-list'), category(recLives, recSize), null);
    if (current === 'records') fitCurrent();
  }
  $$('#records [data-rec-size]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recSize = b.dataset.recSize; syncRecords(); });
  });
  $$('#records [data-rec-lives]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recLives = Number(b.dataset.recLives); syncRecords(); });
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
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
    if (current === 'settings') fitCurrent();
  }
  $$('#settings [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); settingsTab = b.dataset.tab; syncSettingsUi(); });
  });
  $$('#settings [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, val = b.dataset.value;
      arkade.set(key, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('click');
      syncSettingsUi();
    });
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
    if (settingsReturn === 'game' && run) { show('game'); refresh(); $('#pause-overlay').hidden = false; fitOverlays(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (!canPlay()) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      if (!board.hasFocus()) board.focusCursor();
      else board.moveCursor(KEYS[e.key][0], KEYS[e.key][1]);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      setMode(mode === 'open' ? 'flag' : 'open');
    } else if ((e.key === 'Enter' || e.key === ' ') && !board.hasFocus() && document.activeElement === document.body) {
      e.preventDefault();
      onCell(board.cursor);
    }
  });

  // ---------- Layout af spilleskærmen ----------
  // Felterne er kvadratiske og fylder mest muligt. Panelet kan ligge
  //  - ved siden af brættet som en søjle ('col'),
  //  - ved siden af brættet i kompakt form ('compact', lave skærme) eller
  //  - under brættet i kompakt form ('compact' + below, højkant).
  // For hver mulighed prøves panelet i fuld størrelse og nedskaleret (zoom).
  // Vi vælger den, hvor det mindste af felt og knap bliver størst (begge
  // regnes højst til 3 cm). Ved lighed vinder de største knapper, så de
  // store skærme ser ud som før, og til sidst de største felter.
  var GAP_RATIO = 0.07;
  var CM = 96 / 2.54;
  var TARGET_PX = 3 * CM;          // 3 cm
  var MIN_CELL_PX = 1.2 * CM;      // nedre grænse for at kunne vælge et bræt
  var sideCache = null;
  function viewport() { return { W: window.innerWidth, H: window.innerHeight }; }
  function pads(v) {
    var m = Math.min(v.W, v.H);
    return { pad: Math.max(10, m * 0.016), gap: Math.max(12, m * 0.025) };
  }
  // Panelets naturlige størrelse i de to former (måles; skærmen kan være skjult).
  function measureSide() {
    var v = viewport(), key = v.W + 'x' + v.H;
    if (sideCache && sideCache.key === key) return sideCache;
    var game = $('#game'), lay = $('#game-layout'), side = $('.side');
    var wasHidden = game.hidden;
    if (wasHidden) { game.style.visibility = 'hidden'; game.hidden = false; }
    var cls = lay.className, zoom = side.style.zoom;
    side.style.zoom = '';
    lay.className = 'game-layout';
    var a = side.getBoundingClientRect();
    lay.className = 'game-layout compact';
    var c = side.getBoundingClientRect();
    var btn = $('#btn-pause').getBoundingClientRect().width;
    lay.className = cls; side.style.zoom = zoom;
    if (wasHidden) { game.hidden = true; game.style.visibility = ''; }
    sideCache = { key: key, col: { w: a.width, h: a.height }, compact: { w: c.width, h: c.height }, btn: btn };
    return sideCache;
  }
  function better(a, b) {
    for (var i = 0; i < a.length; i++) { if (a[i] > b[i] + 0.25) return true; if (a[i] < b[i] - 0.25) return false; }
    return false;
  }
  var MIN_BTN_PX = 84;              // knapperne (Pause, Åbn/Flag) må ikke zoomes under 84 px
  function plan(sizeId) {
    var s = G.SIZES[sizeId], v = viewport(), p = pads(v), m = measureSide(), best = null;
    // Mindste zoom, så knapperne stadig er 84 px. Er der slet ikke plads, prøves igen uden grænsen.
    var zMin = Math.min(1, MIN_BTN_PX / m.btn);
    for (var pass = 0; pass < 2 && !best; pass++, zMin = 0.3) [['col', false], ['compact', false], ['compact', true]].forEach(function (opt) {
      var sd = m[opt[0]];
      for (var z = 1; z >= Math.max(0.3, zMin) - 1e-9; z -= 0.02) {
        var sw = sd.w * z, sh = sd.h * z, aw, ah;
        if (!opt[1]) { if (sh > v.H - 2 * p.pad) continue; aw = v.W - 2 * p.pad - sw - p.gap; ah = v.H - 2 * p.pad; }
        else { if (sw > v.W - 2 * p.pad) continue; aw = v.W - 2 * p.pad; ah = v.H - 2 * p.pad - sh - p.gap; }
        var cell = Math.floor(Math.min(aw / (s.cols + 0.3), ah / (s.rows + 0.3)));
        if (cell < 8) continue;
        var cg = Math.max(4, Math.round(cell * GAP_RATIO)), vis = cell - cg, btn = m.btn * z;
        var score = [Math.min(vis, btn, TARGET_PX), Math.min(vis, TARGET_PX) + Math.min(btn, TARGET_PX), z, vis];
        if (!best || better(score, best.score)) best = { score: score, cell: cell, cellGap: cg, vis: vis, btn: btn, z: z, side: opt[0], below: opt[1], gap: p.gap };
      }
    });
    if (!best) { // nødløsning for meget små vinduer
      var cell0 = Math.max(8, Math.floor(Math.min(v.W, v.H) / 2 / (Math.max(s.cols, s.rows) + 0.3)));
      best = { cell: cell0, cellGap: 4, vis: cell0 - 4, btn: m.btn * 0.3, z: 0.3, side: 'compact', below: v.W < v.H, gap: p.gap };
    }
    return best;
  }
  function cellSizeFor(sizeId) { return plan(sizeId).cell; }
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var p = plan(run.size), lay = $('#game-layout'), side = $('.side');
    lay.classList.toggle('compact', p.side === 'compact');
    lay.classList.toggle('below', p.below);
    lay.style.setProperty('--game-gap', p.gap + 'px');
    side.style.zoom = p.z < 0.999 ? String(p.z) : '';
    var cell = p.cell, game = $('#game');
    // Sikkerhedsnet: passer det alligevel ikke (fx afrunding), gøres felterne lidt mindre.
    for (var i = 0; i < 60; i++) {
      lay.style.setProperty('--cell', cell + 'px');
      lay.style.setProperty('--cell-gap', Math.max(4, Math.round(cell * GAP_RATIO)) + 'px');
      if (!overflows(game) || cell <= 8) break;
      cell--;
    }
    board.relayout();
    lay.dataset.plan = p.side + (p.below ? '-under' : '-ved-siden') + ' zoom ' + p.z.toFixed(2);
    fitOverlays();
  }

  // ---------- Tilpasning til vinduet (aldrig rulning) ----------
  // Skalerer en skærm med CSS zoom, til alt kan være der. 1 = fuld størrelse.
  // --z følger med, så skærmens højde (100dvh) stadig fylder hele vinduet.
  function setZoom(el, z) {
    el.style.zoom = z === 1 ? '' : String(z);
    if (z === 1) el.style.removeProperty('--z'); else el.style.setProperty('--z', String(z));
  }
  function fitZoom(el, ok) {
    setZoom(el, 1);
    if (ok()) return 1;
    // Trinvis nedad (ikke binær søgning): når rækker ombrydes, er
    // sammenhængen ikke jævn, og den største zoom, der passer, skal findes.
    for (var z = 0.98; z > 0.2; z -= 0.02) {
      setZoom(el, z);
      if (ok()) return z;
    }
    setZoom(el, 0.2);
    return 0.2;
  }
  function rectsApart(a, b, margin) {
    return a.right + margin <= b.left || b.right + margin <= a.left || a.bottom + margin <= b.top || b.bottom + margin <= a.top;
  }
  // Tilbage til hallen må ikke overlappe eller ligge tæt op ad andet på startskærmen.
  function menuClear() {
    var h = $('#btn-hall').getBoundingClientRect();
    return $$('#menu .title-row > *, #menu .lead, #menu .group-label, #menu .menu-group .btn, #size-note, #menu .row > .btn').every(function (e) {
      var r = e.getBoundingClientRect();
      return r.width === 0 || rectsApart(h, r, 8);
    });
  }
  function fitCurrent() {
    if (current === 'game') { layoutGame(); return; }
    var el = $('#' + current);
    fitZoom(el, function () { return !overflows(el) && (current !== 'menu' || menuClear()); });
  }
  function fitOverlays() {
    $$('#game .overlay').forEach(function (o) {
      if (o.hidden) return;
      var panel = $('.panel', o);
      fitZoom(panel, function () {
        var r = panel.getBoundingClientRect(), b = o.getBoundingClientRect();
        return !overflows(panel) && r.height <= b.height - 24 && r.width <= b.width - 24;
      });
    });
  }
  var resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      sideCache = null;
      if (current === 'menu') syncMenu(); else fitCurrent();
    });
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  // ---------- Start ----------
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Minestryger = {
    get run() { return run; }, get plate() { return plate; }, get mode() { return mode; },
    settings: arkade, gameSettings: mine, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, setMode: setMode, cell: onCell, board: board, cellSizeFor: cellSizeFor,
    plan: plan, sizeAllowed: sizeAllowed, effectiveSize: effectiveSize, fit: fitCurrent
  };
})();
