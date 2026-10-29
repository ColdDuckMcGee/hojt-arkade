/*
 * Lys ud – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Blokke og Bomberne.
 *
 * Vælg en lampe (klik, tryk, dwell eller Enter): den og de fire naboer skifter.
 * Sluk alle lamperne. Der er ingen tid. Fortryd er ubegrænset, Forfra starter
 * banen forfra, og Tip viser ét felt fra en korteste løsning (koster point).
 * Baner uden ende – en session slutter først, når du vælger Afslut.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.LysUdGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // boardSize 'auto' = spilleren har ikke selv valgt. Så bliver pladen 5 × 5, eller 4 × 4,
  // hvis lamperne ved 5 × 5 ville blive under ca. 80 px på skærmen (se autoSize).
  // hoverPreview: vis svagt, hvilke lamper der skifter, hvor du kigger.
  var bset = ArkadeSettings.create('lysud', { boardSize: 'auto', hoverPreview: true });
  var records = ArkadeHighscores.create('lysud', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (bset.get('boardSize') !== 'auto' && !G.SIZES[bset.get('boardSize')]) bset.set('boardSize', 'auto');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = én handling. Dwell-modulet slipper sin lås, hvis en knap bliver
  // deaktiveret et øjeblik. Derfor holder spillet sin egen lås på knapperne
  // (lamperne, Fortryd, Forfra og Tip): samme knap kan først dwelles igen, når
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
  // Lydene kommer fra det fælles lydmodul (alle rolige). Lys ud bruger disse navne:
  var SFX = {
    tap: 'move', undo: 'bonusGone', restart: 'bonusGone', tip: 'bonusSpawn', solved: 'bonus',
    record: 'record', click: 'click', pause: 'pause'
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
      : 'Bevægelse i baggrunden og bløde skift på lamperne. Fra giver faste skift';
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
  bset.onChange(function (key) { if (key === 'hoverPreview') { syncSettingsUi(); renderBoard(); } });

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
  function sizeName(id) { return G.SIZES[id].name + ' ' + G.SIZES[id].label; }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function movesText(n) { return n === 1 ? '1 træk' : n + ' træk'; }
  function levelsText(n) { return n === 1 ? '1 bane' : n + ' baner'; }
  function lampsText(n) { return n === 1 ? '1 lampe' : n + ' lamper'; }

  // ---------- Startmenu ----------
  // Lamperne er knapper, så de skal være store. Startskærmen siger til under ca. 1,8 cm.
  var MIN_CM = 1.8;
  function cellCm(size) { return cellSizeFor(size) / (96 / 2.54); }
  function autoSize() { return G.autoSize(cellSizeFor(G.DEFAULT_SIZE)); }
  function isAutoSize() { return bset.get('boardSize') === 'auto'; }
  function boardSize() { return isAutoSize() ? autoSize() : bset.get('boardSize'); }
  function syncMenu() {
    var size = boardSize();
    $$('#menu [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === size)); });
    var cm = cellCm(size), note = '';
    if (cm < MIN_CM) note = 'På denne skærm bliver lamperne ca. ' + cm.toFixed(1).replace('.', ',') + ' cm. ' +
      (size === '3x3' ? 'Fuld skærm giver større lamper.' : 'Vælg en mindre plade eller fuld skærm for større lamper.');
    else if (isAutoSize() && size !== G.DEFAULT_SIZE) note = 'Mellem plade er valgt, så lamperne bliver store nok på denne skærm (ca. ' + cm.toFixed(1).replace('.', ',') + ' cm). Du kan selv vælge en anden.';
    $('#size-note').textContent = note;
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('boardSize', b.dataset.size); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(boardSize()); });
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
  var hoverIdx = -1, curIdx = -1;   // lampen under blikket/musen og tastaturets markør
  var boardEl = $('#board'), cellEls = [];
  var lastNote = '', doneTimer = 0;

  function buildBoard(n) {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--n', n);
    cellEls = [];
    for (var i = 0; i < n * n; i++) {
      var b = document.createElement('button');
      b.className = 'cell turn-btn';
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('role', 'gridcell');
      b.innerHTML = '<span class="pv"></span><svg class="rays" aria-hidden="true"><use href="#lu-rays"/></svg><span class="lamp"></span><span class="tipmark"></span>';
      boardEl.appendChild(b);
      cellEls.push(b);
    }
  }
  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    if (!c || swallowed(c)) return;
    tapCell(+c.dataset.i);
  });
  // Markering af det, der skifter: kun for mus, pen og øjenstyring (ikke for fingre,
  // hvor markeringen ellers ville blive hængende efter trykket).
  boardEl.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var c = e.target.closest('.cell');
    var i = c ? +c.dataset.i : -1;
    if (i !== hoverIdx) { hoverIdx = i; renderBoard(); }
  });
  boardEl.addEventListener('pointerleave', function () { if (hoverIdx >= 0) { hoverIdx = -1; renderBoard(); } });

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(boardSize());
    paused = false; finished = false;
    hoverIdx = -1; curIdx = -1; lastNote = '';
    clearTimeout(doneTimer);
    buildBoard(run.n);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !run.state.solved && current === 'game' && !overlayOpen(); }

  function tapCell(i) {
    if (!live()) return;
    var res = run.tap(i);
    if (!res.ok) return;
    if (curIdx >= 0) curIdx = i;
    if (res.solved) {
      sfx('solved');
      lastNote = '';
      refresh();
      clearTimeout(doneTimer);
      doneTimer = setTimeout(showDone, animationOn() ? 650 : 400);
      return;
    }
    sfx('tap');
    lastNote = '';
    refresh();
  }
  function undoMove() {
    if (!live() || !run.canUndo()) return;
    run.undo();
    sfx('undo');
    lastNote = 'Sidste træk er fortrudt';
    refresh();
  }
  function restartLevel() {
    if (!live() || !run.canRestart()) return;
    run.restart();
    sfx('restart');
    lastNote = 'Banen er startet forfra';
    refresh();
  }
  function showTip() {
    if (!live()) return;
    var had = run.state.hintCell;
    var i = run.hint();
    if (i < 0) return;
    if (had < 0) { sfx('tip'); lastNote = 'Tip: −' + G.RULES.hintCost + ' point'; }
    refresh();
  }

  // ---------- Tegning ----------
  function renderBoard() {
    if (!run || !cellEls.length) return;
    var s = run.state, n = run.n;
    var focus = live() ? (hoverIdx >= 0 ? hoverIdx : curIdx) : -1;
    var pv = {};
    if (focus >= 0 && bset.get('hoverPreview')) run.preview(focus).forEach(function (k) { pv[k] = 1; });
    boardEl.classList.toggle('solved', !!s.solved);
    for (var i = 0; i < cellEls.length; i++) {
      var el = cellEls[i], on = !!s.board[i], cl = el.classList;
      cl.toggle('on', on);
      cl.toggle('pv-on', !!pv[i]);
      cl.toggle('pv-c', !!pv[i] && i === focus);
      cl.toggle('tip', i === s.hintCell);
      cl.toggle('cur', i === curIdx && live());
      var x = i % n, y = Math.floor(i / n);
      var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + (on ? ', tændt' : ', slukket') + (i === s.hintCell ? ', tip: vælg denne' : '');
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      el.setAttribute('aria-pressed', String(on));
    }
  }

  function refresh() {
    if (!run) return;
    var s = run.state, lit = G.litCount(s.board);
    $('#hud-level').textContent = s.level;
    $('#hud-score').textContent = s.score;
    $('#hud-moves').textContent = s.moves;
    $('#hud-min').textContent = s.minMoves;
    $('#points-note').textContent = lastNote || ('Klar på ' + movesText(s.minMoves) + ': +' + G.RULES.perfectBonus + ' i bonus');
    var hint = $('#hint'), cls = '', txt;
    if (s.solved) { txt = 'Alle lamper er slukket!'; cls = 'ok'; }
    else if (s.hintCell >= 0) { txt = 'Tip: vælg lampen med den grønne ring'; cls = 'tipnote'; }
    else txt = 'Sluk alle lamperne · ' + lit + ' tændt';
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    $('#btn-undo').disabled = !live() || !run.canUndo();
    $('#btn-restart').disabled = !live() || !run.canRestart();
    var tipShown = s.hintCell >= 0;
    $('#btn-tip').disabled = !live() || tipShown;
    $('#tip-sub').textContent = tipShown ? 'vises nu' : 'koster ' + G.RULES.hintCost + ' point';
    boardEl.setAttribute('aria-label', 'Plade ' + run.n + ' × ' + run.n + ', ' + lampsText(lit) + ' tændt.');
    renderBoard();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  ['#btn-undo', '#btn-restart', '#btn-tip'].forEach(function (id) { $(id).classList.add('turn-btn'); });
  $('#btn-undo').addEventListener('click', function () { if (!swallowed(this)) undoMove(); });
  $('#btn-restart').addEventListener('click', function () { if (!swallowed(this)) restartLevel(); });
  $('#btn-tip').addEventListener('click', function () { if (!swallowed(this)) showTip(); });

  // ---------- Bane klaret ----------
  function showDone() {
    if (!run || !run.state.solved || finished) return;
    var s = run.state, p = s.lastPoints;
    $('#done-title').textContent = 'Bane ' + s.level + ' klaret';
    $('#done-moves').textContent = 'Du brugte ' + movesText(s.moves) + '. Færrest mulige var ' + movesText(s.minMoves) + '.';
    $('#done-points').textContent = '+' + pointsText(p.total);
    var parts = [p.base + ' for banen (' + s.minMoves + ' × ' + G.RULES.basePoint + ')'];
    if (p.bonus) parts.push(p.bonus + ' i bonus' + (s.moves <= s.minMoves ? ' for færrest mulige træk' : ''));
    else parts.push('ingen bonus');
    if (p.hintCost) parts.push('−' + p.hintCost + ' for ' + (s.hintsUsed === 1 ? '1 tip' : s.hintsUsed + ' tip'));
    $('#done-parts').textContent = parts.join(' · ') + '. I alt ' + pointsText(s.score) + '.';
    $('#btn-next-sub').textContent = 'Bane ' + (s.level + 1);
    $('#done-overlay').hidden = false;
    fitScreen($('#done-overlay'));
    dwell.reset();
    guardUnderGaze($('#done-overlay'));
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextLevel() {
    if (!run || !run.state.solved || finished) return;
    run.nextLevel();
    $('#done-overlay').hidden = true;
    hoverIdx = -1; lastNote = '';
    sfx('click');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-next').addEventListener('click', nextLevel);
  $('#btn-done-quit').addEventListener('click', function () { sfx('click'); askQuit('done'); });

  function setPaused(p) {
    if (!run || finished || run.state.solved) return;
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
  // Afslut (fra pause og fra Bane klaret) spørger først. Nej / Esc går tilbage dertil,
  // hvor man kom fra: fra pause fortsætter spillet, fra Bane klaret vises boksen igen.
  var confirmFrom = null;
  function askQuit(from) {
    if (!run || finished) return;
    confirmFrom = from;
    $('#pause-overlay').hidden = true;
    $('#done-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' og ' + levelsText(s.levelsSolved) + ' klaret. Pointene gemmes i rekorderne.';
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
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish(); });
  function quitToMenu() { run = null; paused = false; clearTimeout(doneTimer); hideOverlays(); show('menu'); }

  // ---------- Slut (Afslut) ----------
  // Sessionen gemmes som rekord pr. pladestørrelse: point, og antal klarede baner som ekstra.
  var lastEntryId = null;
  function saveRecord() {
    var s = run.state, out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(s.sizeId, out.score, { levels: out.levelsSolved });
    return res;
  }
  function finish() {
    if (finished || !run) return;
    clearTimeout(doneTimer);
    var s = run.state, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-reason').textContent = s.solved ? 'Du afsluttede efter bane ' + s.level + '.' : 'Du afsluttede på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    var bits = [levelsText(s.levelsSolved) + ' klaret'];
    if (s.perfectLevels) bits.push(s.perfectLevels + ' med færrest mulige træk');
    $('#go-levels').textContent = bits.join(' · ');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = sizeName(s.sizeId);
    $('#go-records-title').textContent = 'Rekorder – ' + sizeName(s.sizeId);
    renderRecordList($('#go-records'), s.sizeId, lastEntryId);
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
        lv.textContent = ' · ' + levelsText(typeof e.levels === 'number' ? e.levels : 0);
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
  var recSize = G.DEFAULT_SIZE;
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
    if (settingsReturn === 'game' && run && !finished) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Piletasterne flytter markøren, Enter eller mellemrum vælger lampen,
  // Z eller Backspace fortryder, R starter forfra, T giver et tip, Esc eller P giver pause.
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
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === 'Enter' || k === ' ') {
      if (!e.repeat && live()) { if (curIdx < 0) { curIdx = centre(); renderBoard(); } else tapCell(curIdx); }
    }
    else if (k === 'z' || k === 'Backspace') { if (!e.repeat) undoMove(); }
    else if (k === 'r') { if (!e.repeat) restartLevel(); }
    else if (k === 't') { if (!e.repeat) showTip(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapper og lamper er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver de største lamper, og knapperne bliver så store som muligt.
  var FRAME = 6;              // pladens ramme i alt (2 × 3 px)
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }

  function candidates(n, b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 8;
    var hudH = Math.max(48, Math.min(84, b * 0.62)), pauseS = Math.max(small ? SMALL_MIN : 84, hudH);
    var top = Math.max(hudH * 1.0 + 6, pauseS), hint = 50;
    function cell(px) { return Math.floor((px - FRAME) / n); }
    var res = { p: p, g: g, top: top, pauseS: pauseS, hudH: hudH };
    // wide: status | plade | tekst og knapper
    var sideW = Math.min(420, Math.max(240, b * 2));
    var gw = Math.max(10, cssGap(W, H) * 0.45);
    var rightH = 70 + 3 * b + 3 * gw;
    var leftH = 110 + 2 * 84 + 70 + b + 3 * gw;
    res.sideW = sideW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? cell(Math.min(W - 2 * p - 2 * sideW - 2 * g, H - 2 * p)) : 0;
    // side: plade | (status, tekst, knapper)
    var panelW = Math.max(3 * b + 2 * ig, Math.min(W * 0.45, 4.6 * b));
    var panelH = top + hint + b + 2 * ig + g;
    res.panelSide = panelW;
    res.side = (panelH <= H - 2 * p) ? cell(Math.min(W - 2 * p - g - panelW, H - 2 * p)) : 0;
    // below: status / plade / tekst og knapper
    var minW = 3 * b + 2 * ig;
    var bh = H - 2 * p - top - hint - b - ig - 2 * g;
    res.below = (minW <= W - 2 * p) ? cell(Math.min(W - 2 * p, bh)) : 0;
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; });
    return res;
  }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    // Status og knapper ved siden af pladen er rarest på store skærme: wide vinder ved næsten lige store lamper
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    return best;
  }
  function cellSizeFor(sizeId) {
    var v = viewport(), n = G.SIZES[sizeId].n, small = isSmall(v);
    var b = Math.max(small ? SMALL_MIN : 52, cssBtn(v.W, v.H));
    for (var k = 0; k < 16; k++) {
      var res = candidates(n, b, v.W, v.H, small), c = res[pick(res)];
      if (c > 0) return c;
      b = Math.max(small ? SMALL_MIN : 52, b * 0.93);
    }
    return 0;
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res, n, v) {
    var boardPx = cell * n + FRAME;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    $('#hud-min-label').textContent = lay === 'wide' ? 'Færrest mulige' : 'Færrest';
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--pause-s', Math.round(res.pauseS) + 'px');
    st.setProperty('--cell', cell + 'px');
    st.setProperty('--board-px', boardPx + 'px');
    var panelW = lay === 'side' ? res.panelSide : Math.min(v.W - 2 * res.p, Math.max(boardPx, 3 * b + 16));
    st.setProperty('--panel-w', Math.floor(panelW) + 'px');
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), n = run.n, small = isSmall(v);
    var floor = small ? SMALL_MIN : 52;
    var b = Math.max(floor, cssBtn(v.W, v.H)), lay, res, cell;
    for (var k = 0; k < 24; k++) {
      res = candidates(n, b, v.W, v.H, small);
      lay = pick(res);
      cell = res[lay];
      if (!cell && b > floor) { b = Math.max(floor, b * 0.93); continue; }
      cell = Math.max(16, cell || 16);
      applyLayout(lay, b, cell, res, n, v);
      // Passer det ikke helt (fx lange tekster), så mindre lamper, og derefter mindre knapper
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
    root.classList.toggle('lu-lille', small);
    root.classList.toggle('lu-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('lu-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('lu-tvaers')) {
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
  window.LysUd = {
    boardSize: boardSize, autoSize: autoSize, askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get cursor() { return curIdx; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, tap: tapCell, undo: undoMove, restart: restartLevel, tip: showTip,
    next: nextLevel, finish: finish, showDone: showDone, refresh: refresh, cellSizeFor: cellSizeFor,
    setPaused: setPaused
  };
})();
