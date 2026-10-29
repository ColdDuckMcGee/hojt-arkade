/*
 * Blokke – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Bomberne og Labyrinten.
 *
 * Styring i tre trin, uden træk og slip:
 *   1) vælg en af de tre brikker,
 *   2) vælg et felt på brættet – brikken vises som en skygge (grøn passer,
 *      rød passer ikke), og rækker og kolonner, der forsvinder, er markeret,
 *   3) tryk på Læg (eller vælg et andet felt).
 * Fortryd sletter først valget. Er der intet valg, fortryder den sidste træk.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.BlokkeGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // boardSize 'auto' = brugeren har ikke selv valgt. Så vælges brættet ud fra skærmen (se autoSize).
  var bset = ArkadeSettings.create('blokke', { boardSize: 'auto', hoverPreview: true });
  var records = ArkadeHighscores.create('blokke', { max: 10 });

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
  // (felter, brikker, Læg og Fortryd): samme knap kan først dwelles igen, når
  // blikket har forladt den.
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
  // Lydene kommer fra det fælles lydmodul. Blokke bruger disse navne:
  var SFX = {
    pick: 'click', cell: 'move', bad: 'obstacle', place: 'eat', lines: 'bonus', combo: 'record', newSet: 'bonusSpawn',
    undo: 'bonusGone', stuck: 'bonusGone', record: 'record', click: 'click', pause: 'pause'
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
      : 'Bevægelse i baggrunden og når linjer forsvinder. Fra giver en rolig fade';
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
  bset.onChange(function (key) { if (key === 'hoverPreview') { syncSettingsUi(); hoverIdx = -1; render(); } });

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
  function linesText(n) { return n === 1 ? '1 linje' : n + ' linjer'; }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function piecesText(n) { return n === 1 ? '1 brik' : n + ' brikker'; }

  // ---------- Startmenu ----------
  // Felterne er knapper, så de skal være store. Startskærmen siger til under ca. 1,8 cm.
  var MIN_CM = 1.8;
  // Har brugeren ikke selv valgt en størrelse, bliver standarden 8 × 8 – medmindre felterne
  // ved 8 × 8 ville blive under ca. 1,5 cm på denne skærm. Så bliver den 6 × 6.
  // Samme beregning som advarslen herunder (cellSizeFor = spillets eget layout).
  var AUTO_SMALL_CM = 1.5;
  function cellCm(size) { return cellSizeFor(size) / (96 / 2.54); }
  function autoSize() { return cellCm(G.DEFAULT_SIZE) < AUTO_SMALL_CM ? '6x6' : G.DEFAULT_SIZE; }
  function isAutoSize() { return bset.get('boardSize') === 'auto'; }
  function boardSize() { return isAutoSize() ? autoSize() : bset.get('boardSize'); }
  function syncMenu() {
    var size = boardSize();
    $$('#menu [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === size)); });
    var cm = cellCm(size), note = '';
    if (cm < MIN_CM) note = 'På denne skærm bliver felterne ca. ' + cm.toFixed(1).replace('.', ',') + ' cm. ' +
      (size === '6x6' ? 'Fuld skærm giver større felter.' : 'Vælg et mindre bræt eller fuld skærm for større felter.');
    else if (isAutoSize() && size !== G.DEFAULT_SIZE) note = 'Lille bræt er valgt, så felterne bliver store nok på denne skærm (ca. ' + cm.toFixed(1).replace('.', ',') + ' cm). Du kan selv vælge et andet.';
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
  var selSlot = -1, selCell = -1, hoverIdx = -1;
  var boardEl = $('#board'), cellEls = [];
  var vanishing = {}, popping = {}, animTimer = 0, popTimer = 0, stuckTimer = 0;
  var lastNote = '';
  // Zoom i fjerdedele (som Sudoku): i oversigten er brættet fire store knapper
  // (.qbtn), så TD Browse' Color Links ikke får mange små mål tæt på hinanden.
  // I en zoomet fjerdedel er dens felter store og de andre spor smalle (samme
  // samlede størrelse). Felter der ikke kan bruges, er inert. Musen finder
  // stadig feltet under sig (cellAt), så klik og skygge virker som før.
  var zoom = -1, qbtnEls = [];
  var QNAME = ['øverst til venstre', 'øverst til højre', 'nederst til venstre', 'nederst til højre'];
  function quadOf(i) { var n = run.n, h = Math.ceil(n / 2); return (Math.floor(i / n) < h ? 0 : 2) + (i % n < h ? 0 : 1); }

  function buildBoard(n) {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--n', n);
    cellEls = [];
    for (var i = 0; i < n * n; i++) {
      var b = document.createElement('button');
      b.className = 'cell turn-btn';
      b.type = 'button';
      b.dataset.i = i;
      b.innerHTML = '<span class="blk"></span><span class="gh"></span>';
      b.style.gridColumn = String(i % n + 1); b.style.gridRow = String(Math.floor(i / n) + 1);
      b.inert = true;
      boardEl.appendChild(b);
      cellEls.push(b);
    }
    qbtnEls = [];
    for (var q = 0; q < 4; q++) {
      var qb = document.createElement('button');
      qb.type = 'button'; qb.className = 'qbtn'; qb.dataset.q = q;
      qb.setAttribute('aria-label', 'Zoom ind på fjerdedelen ' + QNAME[q]);
      boardEl.appendChild(qb);
      qbtnEls.push(qb);
    }
  }
  // Sporenes bredde ved zoom: de zoomede helst ca. 126 px, de andre smalle.
  function zoomTracks(n, cell, zq) {
    var h = Math.ceil(n / 2), f = Math.min(0.3, Math.max(0.15, (n * cell / 126 - h) / (n - h)));
    var big = n * cell / (h + (n - h) * f), c = [], r = [];
    for (var t = 0; t < n; t++) {
      c.push(((t < h ? 0 : 1) === zq % 2 ? big : big * f).toFixed(2) + 'px');
      r.push(((t < h ? 0 : 1) === zq >> 1 ? big : big * f).toFixed(2) + 'px');
    }
    // m: hvor mange smalle spor en nabo-fjerdedels knap dækker, så dens midte er
    // mindst 124 px fra nærmeste store felt.
    var small = big * f, m = Math.floor(2 * ((n - h) - (124 - big / 2) / small));
    return { c: c.join(' '), r: r.join(' '), big: big, small: small, h: h, m: Math.max(1, Math.min(n - h, m)) };
  }
  function qSpan(n, side, zside, m) {
    var h = Math.ceil(n / 2);
    if (zside < 0 || side === zside) return side ? (h + 1) + ' / ' + (n + 1) : '1 / ' + (h + 1);
    return side ? (n - m + 1) + ' / ' + (n + 1) : '1 / ' + (m + 1);
  }
  function applyZoom(qOn) {
    if (!run || !qbtnEls.length) return;
    var n = run.n, cell = parseFloat(gameEl.dataset.cell) || 0, t = zoom >= 0 && cell ? zoomTracks(n, cell, zoom) : null;
    var cols = t ? t.c : '', rows = t ? t.r : '';
    if (boardEl.style.gridTemplateColumns !== cols) { boardEl.style.gridTemplateColumns = cols; boardEl.style.gridTemplateRows = rows; }
    boardEl.classList.toggle('zoomed', !!t);
    for (var i = 0; i < cellEls.length; i++) {
      var x = i % n, y = Math.floor(i / n), cs = t ? Math.min((x < t.h) === (zoom % 2 === 0) ? t.big : t.small, (y < t.h) === (zoom < 2) ? t.big : t.small) : cell;
      cellEls[i].style.setProperty('--cs', cs.toFixed(1) + 'px');
    }
    qbtnEls.forEach(function (q, k) {
      var on = qOn && k !== zoom;
      if (q.inert !== !on) q.inert = !on;
      q.hidden = !!t && k === zoom;
      var gc = qSpan(n, k % 2, t ? zoom % 2 : -1, t ? t.m : 0), gr = qSpan(n, k >> 1, t ? zoom >> 1 : -1, t ? t.m : 0);
      if (q.style.gridColumn !== gc) q.style.gridColumn = gc;
      if (q.style.gridRow !== gr) q.style.gridRow = gr;
    });
  }
  function setZoom(k) { if (!live() || k === zoom) return; zoom = k; sfx('click'); refresh(); }
  function cellAt(x, y) {
    for (var i = 0; i < cellEls.length; i++) {
      var r = cellEls[i].getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return i;
    }
    return -1;
  }
  // Felt under musen, også når feltet er inert (så rammer klikket brættet)
  function cellFromEvent(e) {
    var c = e.target.closest('.cell');
    if (c) return +c.dataset.i;
    return e.target === boardEl ? cellAt(e.clientX, e.clientY) : -1;
  }
  boardEl.addEventListener('click', function (e) {
    var q = e.target.closest('.qbtn');
    if (q) { if (!swallowed(q)) setZoom(+q.dataset.q); return; }
    var c = e.target.closest('.cell');
    if (c) { if (!swallowed(c)) selectCell(+c.dataset.i); return; }
    // Inert felt: i en anden fjerdedel zoomes der dertil, ellers er klikket som
    // på et ulovligt felt før (rød skygge, intet lægges).
    var i = cellFromEvent(e);
    if (i < 0 || !live()) return;
    if (zoom >= 0 && quadOf(i) !== zoom) setZoom(quadOf(i));
    else if (zoom >= 0) selectCell(i);
  });
  function hoverAt(e) {
    var i = e.target.closest('.qbtn') ? -1 : cellFromEvent(e);
    if (i >= 0 && zoom >= 0 && quadOf(i) !== zoom) i = -1;
    if (i !== hoverIdx) { hoverIdx = i; renderBoard(); }
  }
  boardEl.addEventListener('pointerover', hoverAt);
  boardEl.addEventListener('pointermove', function (e) { if (e.target === boardEl) hoverAt(e); });
  boardEl.addEventListener('pointerleave', function () { if (hoverIdx >= 0) { hoverIdx = -1; renderBoard(); } });

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(boardSize());
    paused = false; finished = false;
    selSlot = -1; selCell = -1; hoverIdx = -1; vanishing = {}; popping = {}; lastNote = ''; zoom = -1;
    clearTimeout(animTimer); clearTimeout(popTimer); clearTimeout(stuckTimer);
    buildBoard(run.n);
    hideOverlays();
    show('game');
    autoSelect();
    refresh();
  }
  function hideOverlays() { ['#pause-overlay', '#stuck-overlay'].forEach(function (o) { $(o).hidden = true; }); }
  function overlayOpen() { return !$('#pause-overlay').hidden || !$('#stuck-overlay').hidden; }
  function live() { return run && !paused && !run.state.over && current === 'game' && !overlayOpen(); }

  // Er der kun én brik tilbage, der kan lægges, vælges den af sig selv.
  function autoSelect() {
    var s = run.state, fit = [];
    s.tray.forEach(function (p, i) { if (p && run.slotFits(i)) fit.push(i); });
    var left = run.remaining().length;
    if (left === 1 && fit.length === 1) selSlot = fit[0];
  }

  function currentPreview() {
    if (!run || selSlot < 0 || selCell < 0) return null;
    return run.preview(selSlot, selCell % run.n, Math.floor(selCell / run.n));
  }

  function selectPiece(slot) {
    if (!live()) return;
    var p = run.state.tray[slot];
    if (!p || !run.slotFits(slot)) return;
    selSlot = selSlot === slot ? -1 : slot;
    sfx('pick');
    refresh();
    var pv = currentPreview();
    if (pv && !pv.ok) sfx('bad');
  }
  function selectCell(i) {
    if (!live()) return;
    if (i === selCell) return; // samme felt igen: intet sker (læg med Læg-knappen)
    selCell = i;
    if (quadOf(i) !== zoom) zoom = quadOf(i);
    var pv = currentPreview();
    sfx(pv && !pv.ok ? 'bad' : 'cell');
    refresh();
  }
  function clearSelection() { selSlot = -1; selCell = -1; }

  function place() {
    if (!live()) return;
    var pv = currentPreview();
    if (!pv || !pv.ok) return;
    var before = run.state.board.slice();
    var res = run.place(selSlot, selCell % run.n, Math.floor(selCell / run.n));
    if (!res.ok) return;
    // Rydning: de ryddede felter toner roligt ud
    var now = performance.now();
    res.cleared.forEach(function (i) { vanishing[i] = before[i] || res.piece.color; });
    res.cells.forEach(function (i) { if (!(i in vanishing)) popping[i] = 1; });
    clearTimeout(animTimer); clearTimeout(popTimer);
    animTimer = setTimeout(function () { vanishing = {}; renderBoard(); }, 460);
    popTimer = setTimeout(function () { popping = {}; renderBoard(); }, 300);
    // Lyd
    if (res.k) { sfx(res.combo > 1 || res.k > 1 ? 'combo' : 'lines'); }
    else sfx('place');
    if (res.newSet && !res.over) setTimeout(function () { sfx('newSet'); }, 260);
    // Tekst om pointene
    var pts = res.points, bits = ['+' + pointsText(pts.total)];
    if (res.k) bits.push(linesText(res.k) + ' ryddet');
    if (pts.combo) bits.push('kombo ' + res.combo);
    if (pts.empty) bits.push('tomt bræt!');
    lastNote = bits.join(' · ');
    clearSelection();
    hoverIdx = -1;
    if (res.over) {
      refresh();
      stuckTimer = setTimeout(showStuck, animationOn() ? 700 : 450);
      return;
    }
    autoSelect();
    refresh();
    void now;
  }

  function undoAction() {
    if (!run || paused || current !== 'game') return;
    if (!$('#stuck-overlay').hidden) { undoMove(); return; }
    if (overlayOpen()) return;
    if (selSlot >= 0 || selCell >= 0) { clearSelection(); sfx('click'); refresh(); return; }
    undoMove();
  }
  function undoMove() {
    if (!run || !run.canUndo()) return;
    clearTimeout(stuckTimer);
    run.undo();
    sfx('undo');
    vanishing = {}; popping = {}; clearSelection(); lastNote = 'Sidste træk er fortrudt';
    $('#stuck-overlay').hidden = true;
    dwell.reset();
    autoSelect();
    refresh();
  }

  // ---------- Tegning ----------
  function renderBoard() {
    if (!run || !cellEls.length) return;
    var s = run.state, n = run.n;
    var pv = currentPreview();
    var ghost = {}, clr = {}, anchor = -1, okGhost = pv && pv.ok;
    if (pv) { pv.cells.forEach(function (i) { ghost[i] = 1; }); pv.cleared.forEach(function (i) { clr[i] = 1; }); anchor = pv.anchor; }
    var okAt = {};
    if (selSlot >= 0 && zoom >= 0) for (var j = 0; j < cellEls.length; j++) {
      if (quadOf(j) !== zoom) continue;
      var pj = run.preview(selSlot, j % n, Math.floor(j / n));
      if (pj && pj.ok) okAt[j] = 1;
    }
    var hov = {};
    if (bset.get('hoverPreview') && selSlot >= 0 && hoverIdx >= 0 && hoverIdx !== selCell && live()) {
      var hp = run.preview(selSlot, hoverIdx % n, Math.floor(hoverIdx / n));
      if (hp) hp.cells.forEach(function (i) { if (!ghost[i]) hov[i] = 1; });
    }
    for (var i = 0; i < cellEls.length; i++) {
      var el = cellEls[i], v = s.board[i], van = !v && (i in vanishing);
      var color = v || (van ? vanishing[i] : 0);
      if (color) el.dataset.c = color; else delete el.dataset.c;
      var cl = el.classList;
      cl.toggle('f', !!color);
      cl.toggle('vanish', van);
      cl.toggle('pop', !!v && !!popping[i]);
      cl.toggle('g-ok', !!ghost[i] && okGhost);
      cl.toggle('g-bad', !!ghost[i] && !okGhost);
      cl.toggle('anchor', i === anchor);
      cl.toggle('clr', !!clr[i]);
      cl.toggle('sel', i === selCell);
      cl.toggle('hv', !!hov[i]);
      var x = i % n, y = Math.floor(i / n);
      var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + (v ? ', optaget' : ', tomt');
      if (ghost[i]) label += okGhost ? ', brikken lægges her' : (v ? ', brikken rammer en blok her' : ', skygge');
      if (clr[i]) label += ', forsvinder';
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      // Klikbar kun i den zoomede fjerdedel, og kun hvis feltet kan bruges: med
      // valgt brik de felter, hvor den kan lægges; uden brik de tomme felter.
      var use = live() && zoom >= 0 && quadOf(i) === zoom && (i === selCell || (selSlot >= 0 ? !!(okAt[i]) : !v));
      if (el.inert !== !use) el.inert = !use;
    }
    applyZoom(live());
  }

  function renderTray() {
    var s = run.state;
    $$('.piece-btn').forEach(function (b) {
      var slot = +b.dataset.slot, p = s.tray[slot], mini = b.querySelector('.mini');
      var fits = !!p && run.slotFits(slot);
      b.classList.toggle('used', !p);
      b.classList.toggle('nofit', !!p && !fits);
      b.setAttribute('aria-pressed', String(slot === selSlot));
      b.disabled = !p || !fits || !live();
      var sub = b.querySelector('.small');
      var subText = !p ? 'lagt' : (!fits ? 'ingen plads' : '');
      if (subText) { if (!sub) { sub = document.createElement('span'); sub.className = 'small'; b.appendChild(sub); } sub.textContent = subText; }
      else if (sub) sub.remove();
      b.setAttribute('aria-label', 'Brik ' + (slot + 1) + (p ? ', ' + p.size + (p.size === 1 ? ' felt' : ' felter') + (fits ? '' : ', kan ikke være på brættet') : ', allerede lagt'));
      var key = p ? p.id : '';
      if (mini.dataset.piece !== key) {
        mini.dataset.piece = key;
        mini.innerHTML = '';
        if (p) {
          mini.dataset.c = p.color;
          mini.style.setProperty('--pw', p.w); mini.style.setProperty('--ph', p.h);
          var on = {};
          p.cells.forEach(function (c) { on[c[1] * p.w + c[0]] = 1; });
          for (var k = 0; k < p.w * p.h; k++) {
            var it = document.createElement('i');
            if (on[k]) it.className = 'on' + ((k === p.anchor[1] * p.w + p.anchor[0]) ? ' anc' : '');
            mini.appendChild(it);
          }
        }
      }
    });
    sizeMinis();
  }
  // Brikkerne i bakken skaleres, så de fylder knappen, men et lille felt aldrig
  // bliver kæmpestort. Ankerfeltet har en prik: det felt lander dér, hvor du peger.
  function sizeMinis() {
    $$('.piece-btn').forEach(function (b) {
      var mini = b.querySelector('.mini'), id = mini.dataset.piece;
      if (!id) return;
      var p = G.PIECES[id], r = b.getBoundingClientRect();
      if (!r.width) return;
      var w = r.width - 22, h = r.height - 30;
      var cap = Math.min(r.width, r.height) * 0.72 / 3;
      var cell = parseFloat(gameEl.dataset.cell) || 60;
      var m = Math.floor(Math.min((w - (p.w - 1) * 2) / p.w, (h - (p.h - 1) * 2) / p.h, cap, cell * 0.7));
      mini.style.setProperty('--m', Math.max(6, m) + 'px');
    });
  }

  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-score').textContent = s.score;
    $('#hud-best').textContent = Math.max(records.best(s.sizeId), s.score);
    $('#hud-lines').textContent = s.lines;
    $('#hud-combo').textContent = s.combo > 1 ? '×' + s.combo : '–';
    $('#points-note').textContent = lastNote;
    renderTray();
    var pv = currentPreview();
    var hint = $('#hint'), cls = '';
    var txt;
    if (s.over) txt = 'Ingen af brikkerne kan være på brættet';
    else if (selSlot < 0 && selCell < 0) txt = 'Vælg en brik';
    else if (selSlot < 0) txt = 'Vælg en brik – den lægges ved det valgte felt';
    else if (selCell < 0) txt = 'Vælg et felt på brættet. Prikken i brikken lander på feltet';
    else if (!pv.ok) { txt = 'Brikken kan ikke ligge her. Vælg et andet felt'; cls = 'bad'; }
    else if (pv.k) { txt = 'Passer! ' + linesText(pv.k) + ' forsvinder: +' + pointsText(pv.score.total) + '. Tryk på Læg'; cls = 'ok'; }
    else { txt = 'Passer: +' + pointsText(pv.score.total) + '. Tryk på Læg'; cls = 'ok'; }
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    $('#btn-place').disabled = !(live() && pv && pv.ok);
    var hasSel = selSlot >= 0 || selCell >= 0;
    $('#undo-label').textContent = hasSel ? 'Fortryd valg' : 'Fortryd';
    $('#undo-sub').textContent = hasSel ? 'brik og felt' : (s.undoLeft > 0 ? (s.undoLeft === 1 ? '1 træk tilbage' : s.undoLeft + ' træk tilbage') : 'ingen tilbage');
    $('#btn-undo').setAttribute('aria-label', hasSel ? 'Fortryd valget af brik og felt' : 'Fortryd sidste træk (' + $('#undo-sub').textContent + ')');
    $('#btn-undo').disabled = !live() || (!hasSel && !run.canUndo());
    boardEl.setAttribute('aria-label', 'Spillebræt ' + run.n + ' × ' + run.n + '. ' + txt + '.');
    renderBoard();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  $$('.piece-btn').forEach(function (b) {
    b.classList.add('turn-btn');
    b.addEventListener('click', function () { if (!swallowed(b)) selectPiece(+b.dataset.slot); });
  });
  $('#btn-place').classList.add('turn-btn');
  $('#btn-undo').classList.add('turn-btn');
  $('#btn-place').addEventListener('click', function () { if (!swallowed(this)) place(); });
  $('#btn-undo').addEventListener('click', function () { if (!swallowed(this)) undoAction(); });

  // ---------- Ingen flere træk ----------
  function showStuck() {
    if (!run || !run.state.over) return;
    var s = run.state, left = run.remaining().length;
    $('#stuck-reason').textContent = (left === 1 ? 'Den sidste brik' : 'Ingen af de ' + left + ' brikker') + ', du har tilbage, kan være på brættet. Spillet er slut.';
    $('#btn-result-sub').textContent = pointsText(s.score);
    $('#btn-stuck-undo').hidden = !run.canUndo();
    $('#stuck-undo-sub').textContent = s.undoLeft === 1 ? '1 tilbage' : s.undoLeft + ' tilbage';
    $('#stuck-overlay').hidden = false;
    sfx('stuck');
    fitScreen($('#stuck-overlay'));
    refresh();
    dwell.reset();
    $('#btn-result').focus({ preventScroll: true });
  }
  $('#btn-result').addEventListener('click', function () { sfx('click'); $('#stuck-overlay').hidden = true; gameOver(); });
  $('#btn-stuck-undo').addEventListener('click', function () { undoMove(); });

  function setPaused(p) {
    if (!run || run.state.over || !$('#stuck-overlay').hidden) return;
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
  function quitToMenu() { run = null; paused = false; clearTimeout(stuckTimer); hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished || !run) return;
    finished = true;
    var s = run.state, cat = s.sizeId, rankText = '';
    lastEntryId = null;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (s.score > 0) {
      var res = records.add(cat, s.score, { lines: s.lines });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    $('#go-reason').textContent = 'Ingen af brikkerne kunne være på brættet.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = linesText(s.lines) + ' ryddet · ' + piecesText(s.moves) + ' lagt' + (s.bestCombo > 1 ? ' · bedste kombo ' + s.bestCombo : '');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = sizeName(s.sizeId);
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
        lv.textContent = ' · ' + linesText(typeof e.lines === 'number' ? e.lines : 0);
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
    if (settingsReturn === 'game' && run) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function moveCursor(d) {
    if (!live()) return;
    var n = run.n, i = selCell;
    if (i < 0) i = (hoverIdx >= 0 ? hoverIdx : Math.floor(n / 2) * n + Math.floor((n - 1) / 2));
    else {
      var x = Math.max(0, Math.min(n - 1, i % n + d[0])), y = Math.max(0, Math.min(n - 1, Math.floor(i / n) + d[1]));
      i = y * n + x;
    }
    selectCell(i);
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (overlayOpen()) {
      // Fortryd virker også fra "ikke flere træk"-boksen
      if (!$('#stuck-overlay').hidden && (k === 'z' || k === 'Backspace')) { e.preventDefault(); undoMove(); }
      return; // ellers: Enter og mellemrum virker på den fokuserede knap
    }
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === '1' || k === '2' || k === '3') { if (!e.repeat) selectPiece(+k - 1); }
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) place(); }
    else if (k === 'z' || k === 'Backspace') { if (!e.repeat) undoAction(); }
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
  var FRAME = 6;              // brættets ramme i alt (2 × 3 px)
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
    // wide: status | bræt | brikker og knapper
    var sideW = Math.min(420, Math.max(240, b * 2));
    var gw = Math.max(10, cssGap(W, H) * 0.45);
    var rightH = 3 * b + 2 * gw + 2 * gw + 70 + 2 * b + gw;
    res.sideW = sideW;
    res.wide = rightH <= H - 2 * p ? cell(Math.min(W - 2 * p - 2 * sideW - 2 * g, H - 2 * p)) : 0;
    // side: bræt | (status, brikker, tip, knapper)
    var panelW = Math.max(3 * b + 2 * ig, Math.min(W * 0.42, 4.4 * b));
    var panelH = top + b + hint + b + 3 * ig + g;
    res.panelSide = panelW;
    res.side = (panelH <= H - 2 * p) ? cell(Math.min(W - 2 * p - g - panelW, H - 2 * p)) : 0;
    // below: status / bræt / brikker, tip og knapper
    var minW = 3 * b + 2 * ig;
    var bh = H - 2 * p - top - b - hint - b - 2 * ig - 2 * g;
    res.below = (minW <= W - 2 * p) ? cell(Math.min(W - 2 * p, bh)) : 0;
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; });
    return res;
  }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    // Brikker ved siden af brættet er rarest på store skærme: wide vinder ved næsten lige store felter
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
    st.setProperty('--piece-h', b + 'px');
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
    applyZoom(live());
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
    sizeMinis();
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('bk-lille', small);
    root.classList.toggle('bk-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('bk-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('bk-tvaers')) {
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
  window.Blokke = {
    boardSize: boardSize, autoSize: autoSize,
    get run() { return run; }, get selection() { return { slot: selSlot, cell: selCell }; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, selectPiece: selectPiece, selectCell: selectCell, place: place, setZoom: setZoom, get zoom() { return zoom; },
    undo: undoAction, refresh: refresh, cellSizeFor: cellSizeFor, gameOver: gameOver, showStuck: showStuck
  };
})();
