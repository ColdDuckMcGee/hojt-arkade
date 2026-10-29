/*
 * Søslag – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Blokke og Bomberne.
 *
 * Kun ét hav vises stort ad gangen. Når man skyder, er computerens hav stort,
 * og ens eget hav står lille ved siden af (eller under) brættet på en stor
 * knap, der skifter visning. Det lille hav viser hele tiden computerens skud.
 *
 * Et skud tager to valg: vælg et felt (sigtet vises), og tryk på Skyd.
 * Felter, der allerede er skudt på, kan ikke vælges. Computerens tur kommer
 * efter en rolig pause på ca. 1 sekund og vises over brættet.
 *
 * Placering: skibene ligger tilfældigt fra start (Bland igen giver en ny
 * flåde). Man kan også flytte dem selv: vælg skib, vælg felt, vælg vandret
 * eller lodret, og tryk på Læg.
 */
(function () {
  'use strict';

  var $ = function (sel, rootEl) { return (rootEl || document).querySelector(sel); };
  var $$ = function (sel, rootEl) { return Array.prototype.slice.call((rootEl || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.SoeslagGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var sset = ArkadeSettings.create('soeslag', { boardSize: G.DEFAULT_SIZE, level: G.DEFAULT_LEVEL });
  var records = ArkadeHighscores.create('soeslag', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.SIZES[sset.get('boardSize')]) sset.set('boardSize', G.DEFAULT_SIZE);
  if (!G.LEVELS[sset.get('level')]) sset.set('level', G.DEFAULT_LEVEL);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = én handling. Dwell-modulet slipper sin lås, hvis en knap bliver
  // deaktiveret et øjeblik (fx Skyd lige efter et skud). Derfor holder spillet
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
  // Lydene kommer fra det fælles lydmodul. Søslag bruger disse navne:
  var SFX = {
    aim: 'move', fire: 'click', miss: 'bonusGone', hit: 'eat', sunk: 'bonus', aiTurn: 'bonusSpawn',
    aiMiss: 'bonusGone', aiHit: 'obstacle', aiSunk: 'crash', win: 'record', lose: 'crash',
    pick: 'click', place: 'eat', bad: 'obstacle', shuffle: 'bonusSpawn', click: 'click', pause: 'pause', record: 'record'
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
      : 'Bevægelse i baggrunden og når et skud lander. Fra giver en rolig fade';
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
    if (id === 'menu') syncMenu();
    if (id === 'game') { if (run) refresh(); layoutGame(); } else fitScreen($('#' + id), true);
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function sizeLabel(id) { return G.SIZES[id].label; }
  function levelName(id) { return G.LEVELS[id].name; }
  function catOf(level, size) { return level + '|' + size; }
  function catName(level, size) { return levelName(level) + ' · ' + sizeLabel(size); }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function winsText(n) { return n === 1 ? '1 kamp vundet' : n + ' kampe vundet'; }
  function shotsText(n) { return n === 1 ? '1 skud' : n + ' skud'; }
  function cmText(px) { return (px / (96 / 2.54)).toFixed(1).replace('.', ','); }
  // "dit slagskib", "computerens krydser" – skibsnavne med lille begyndelsesbogstav i sætninger
  function shipLower(ship) { return ship.name.charAt(0).toLowerCase() + ship.name.slice(1); }

  // ---------- Startmenu ----------
  // Målet er felter på ca. 3 × 3 cm. Startskærmen siger til, hvis de bliver mindre.
  // 10 × 10 kan kun vælges, hvis felterne bliver mindst ca. 1,5 cm.
  var GOAL_CM = 3, MIN_BIG_CM = 1.5, PX_CM = 96 / 2.54;
  function boardSize() {
    var id = sset.get('boardSize');
    if (id !== G.DEFAULT_SIZE && !sizeAllowed(id)) return G.DEFAULT_SIZE;
    return id;
  }
  function sizeAllowed(id) { return id === G.DEFAULT_SIZE || cellSizeFor(id) >= MIN_BIG_CM * PX_CM; }
  function syncMenu() {
    var size = boardSize(), level = sset.get('level');
    $$('#menu [data-size]').forEach(function (b) {
      var allowed = sizeAllowed(b.dataset.size);
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
      b.disabled = !allowed;
      b.querySelector('.small').textContent = sizeLabel(b.dataset.size) + (allowed ? '' : ' – for småt her');
    });
    $$('#menu [data-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.level === level)); });
    var px = cellSizeFor(size), note = '';
    if (px < (GOAL_CM - 0.05) * PX_CM) {
      note = 'På denne skærm bliver felterne ca. ' + cmText(px) + ' cm (målet er 3 cm). ' +
        (size === G.DEFAULT_SIZE ? 'Fuld skærm giver lidt større felter.' : 'Vælg 8 × 8 eller fuld skærm for større felter.');
    }
    if (!sizeAllowed('10x10')) note += (note ? ' ' : '') + '10 × 10 kræver en større skærm.';
    $('#size-note').textContent = note;
    $('#start-sub').textContent = levelName(level) + ' · ' + sizeLabel(size);
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () { sset.set('boardSize', b.dataset.size); syncMenu(); sfx('click'); });
  });
  $$('#menu [data-level]').forEach(function (b) {
    b.addEventListener('click', function () { sset.set('level', b.dataset.level); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(sset.get('level'), boardSize()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, sset].forEach(function (s) {
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
  function onFs() { syncFullscreen(); cellCache = {}; if (current === 'menu') syncMenu(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, finished = false;
  var view = 'enemy';           // hvilket hav er stort: 'enemy' (computerens) eller 'home' (dit)
  var aim = -1;                 // valgt felt (kamp: sigtet, placering: stævnen)
  var selShip = null, orient = 'h';
  var aiTimer = 0, endTimer = 0, busy = false;
  var note = '', aiNote = '', fresh = -1, freshAi = -1;
  var gameEl = $('#game'), gridEl = $('#game-grid'), boardEl = $('#board'), miniEl = $('#mini');
  var cellEls = [], miniEls = [], builtN = 0;

  function buildBoard(n) {
    if (builtN === n) return;
    builtN = n;
    boardEl.innerHTML = ''; miniEl.innerHTML = '';
    $('#cols').innerHTML = ''; $('#rows').innerHTML = '';
    gameEl.style.setProperty('--n', n);
    cellEls = []; miniEls = [];
    for (var k = 0; k < n; k++) {
      var c = document.createElement('span'); c.textContent = G.COLS.charAt(k); $('#cols').appendChild(c);
      var r = document.createElement('span'); r.textContent = String(k + 1); $('#rows').appendChild(r);
    }
    for (var i = 0; i < n * n; i++) {
      var b = document.createElement('button');
      b.className = 'cell turn-btn';
      b.type = 'button';
      b.dataset.i = i;
      b.innerHTML = '<span class="hl"></span><span class="gh"></span><span class="mk"></span>';
      boardEl.appendChild(b);
      cellEls.push(b);
      var m = document.createElement('i');
      m.className = 'cell';
      m.innerHTML = '<span class="hl"></span><span class="mk"></span>';
      miniEl.appendChild(m);
      miniEls.push(m);
    }
  }
  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    if (!c || swallowed(c)) return;
    if (c.getAttribute('aria-disabled') === 'true') return;
    pickCell(+c.dataset.i);
  });

  function phase() { return run ? run.state.phase : 'place'; }
  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(boardSize(), sset.get('level'));
    paused = false; finished = false;
    $('#pause-overlay').hidden = true;
    startMatch();
    show('game');
  }
  function startMatch() {
    clearTimeout(aiTimer); clearTimeout(endTimer);
    busy = false; view = 'home'; aim = -1; selShip = null; orient = 'h';
    note = ''; aiNote = ''; fresh = -1; freshAi = -1;
    buildBoard(run.n);
    refresh(true);
  }
  function overlayOpen() { return !$('#pause-overlay').hidden; }
  function live() { return run && !paused && !busy && current === 'game' && !overlayOpen() && (phase() === 'place' || phase() === 'battle'); }

  // ----- Placering -----
  function shipAt(i) {
    if (!run) return null;
    var f = run.state.fleet;
    for (var k = 0; k < f.length; k++) if (f[k].cells.indexOf(i) >= 0) return f[k];
    return null;
  }
  function placePreview() {
    if (!run || phase() !== 'place' || !selShip || aim < 0) return null;
    return run.previewMove(selShip, aim % run.n, Math.floor(aim / run.n), orient === 'h');
  }
  function samePlace(pv) {
    var sh = run.shipById(selShip);
    return pv && sh && pv.x === sh.x && pv.y === sh.y && pv.horiz === sh.horiz;
  }
  function chooseShip(id) {
    if (!live() || phase() !== 'place') return;
    if (selShip === id) { selShip = null; aim = -1; sfx('click'); refresh(); return; }
    selShip = id;
    var sh = run.shipById(id);
    orient = sh.horiz ? 'h' : 'v';
    aim = sh.y * run.n + sh.x;
    note = '';
    sfx('pick');
    refresh();
  }
  function chooseOrient(o) {
    if (!live() || phase() !== 'place') return;
    if (orient === o) return;
    orient = o;
    var pv = placePreview();
    sfx(pv && !pv.ok ? 'bad' : 'click');
    refresh();
  }
  function placeShip() {
    if (!live() || phase() !== 'place') return;
    var pv = placePreview();
    if (!pv || !pv.ok || samePlace(pv)) return;
    var sh = run.shipById(selShip);
    var res = run.moveShip(selShip, pv.x, pv.y, pv.horiz);
    if (!res.ok) return;
    note = sh.name + ' er lagt på ' + G.coord(run.n, res.ship.cells[0]) + (pv.horiz ? ', vandret.' : ', lodret.');
    selShip = null; aim = -1;
    sfx('place');
    refresh();
  }
  function shuffle() {
    if (!live() || phase() !== 'place') return;
    run.shuffle();
    selShip = null; aim = -1; note = 'Skibene er blandet igen.';
    sfx('shuffle');
    refresh();
  }
  function beginBattle() {
    if (!live() || phase() !== 'place') return;
    if (!run.begin()) return;
    view = 'enemy'; aim = -1; selShip = null; note = ''; aiNote = '';
    sfx('click');
    refresh(true);
  }

  // ----- Kamp -----
  function pickCell(i) {
    if (!live()) return;
    if (phase() === 'place') {
      var sh = shipAt(i);
      // Et andet skib: vælg det skib. Ellers er feltet stævnens nye plads.
      if (sh && sh.id !== selShip) { chooseShip(sh.id); return; }
      if (!selShip) { aim = i; note = 'Vælg først et skib – på listen eller på havet.'; sfx('click'); refresh(); return; }
      if (i === aim) return;
      aim = i;
      var pv = placePreview();
      sfx(pv && !pv.ok ? 'bad' : 'aim');
      refresh();
      return;
    }
    if (view !== 'enemy') return;
    if (run.state.enemy.shots[i] !== G.NONE) return;   // allerede skudt på
    if (i === aim) return;                              // samme felt igen: intet sker (skyd med Skyd)
    aim = i;
    sfx('aim');
    refresh();
  }
  function shoot() {
    if (!live() || phase() !== 'battle' || view !== 'enemy' || run.state.turn !== 'player') return;
    if (aim < 0 || run.state.enemy.shots[aim] !== G.NONE) return;
    var res = run.playerFire(aim);
    if (!res.ok) return;
    var where = G.coord(run.n, res.i);
    fresh = res.i; aim = -1;
    if (res.result === 'miss') { note = where + ': Plask. Intet skib.'; sfx('miss'); }
    else if (res.result === 'hit') { note = where + ': Ramt!'; sfx('hit'); }
    else { note = where + ': Du sænkede computerens ' + shipLower(res.ship) + '! +' + pointsText(G.RULES.sunkPoint); sfx('sunk'); }
    if (res.allSunk) {
      busy = true;
      refresh();
      endTimer = setTimeout(function () { busy = false; sfx('win'); refresh(true); }, animationOn() ? 700 : 450);
      return;
    }
    busy = true;
    aiNote = 'Computeren sigter …';
    refresh();
    scheduleAi();
  }
  function scheduleAi() {
    clearTimeout(aiTimer);
    aiTimer = setTimeout(aiTurn, G.RULES.aiDelayMs);
    setTimeout(function () { if (busy && run && run.state.turn === 'ai' && !paused) sfx('aiTurn'); }, 150);
  }
  function aiTurn() {
    if (!run || paused || run.state.turn !== 'ai') return;
    var res = run.aiFire();
    if (!res.ok) return;
    var where = G.coord(run.n, res.i);
    freshAi = res.i;
    if (res.result === 'miss') { aiNote = 'Computeren skød på ' + where + ': Plask.'; sfx('aiMiss'); }
    else if (res.result === 'hit') { aiNote = 'Computeren skød på ' + where + ' og ramte dit ' + shipLower(res.ship) + '.'; sfx('aiHit'); }
    else { aiNote = 'Computeren skød på ' + where + ' og sænkede dit ' + shipLower(res.ship) + '.'; sfx('aiSunk'); }
    if (res.allSunk) {
      refresh();
      endTimer = setTimeout(function () { busy = false; view = 'enemy'; sfx('lose'); refresh(true); }, animationOn() ? 900 : 600);
      return;
    }
    busy = false;
    refresh();
  }
  function toggleView() {
    if (!run || paused || current !== 'game' || phase() === 'place') return;
    view = view === 'enemy' ? 'home' : 'enemy';
    sfx('click');
    refresh();
  }
  function endAction() {
    if (!run) return;
    if (phase() === 'won') { sfx('click'); run.nextMatch(); startMatch(); }
    else if (phase() === 'lost') { sfx('click'); gameOver(); }
  }

  // ---------- Tegning ----------
  // Fælles for begge have: skrog, skud og markeringer. Klasser pr. felt:
  //   hull + end-l/end-r/end-t/end-b/mid  skibets skrog (stævn og hæk er runde)
  //   m-miss (ring), m-hit (kryds), m-sunk (fyldt felt med kryds), reveal (skjult skib, vist til sidst)
  function seaClasses(sea, ships, showShips, revealAll) {
    var n = run.n, out = new Array(n * n);
    for (var i = 0; i < n * n; i++) out[i] = { hull: '', ship: null, shot: sea ? sea.shots[i] : 0, reveal: false };
    (ships || []).forEach(function (sh) {
      var sunk = sea ? sh.cells.every(function (c) { return sea.shots[c] === G.SUNK; }) : false;
      if (!showShips && !sunk && !revealAll) return;
      sh.cells.forEach(function (c, k) {
        var part = k === 0 ? (sh.horiz ? 'end-l' : 'end-t') : k === sh.len - 1 ? (sh.horiz ? 'end-r' : 'end-b') : (sh.horiz ? 'mid-h' : 'mid-v');
        out[c].hull = part; out[c].ship = sh;
        out[c].reveal = !showShips && !sunk;
      });
    });
    return out;
  }
  function applyCell(el, info, extra) {
    var cl = el.classList;
    cl.toggle('hull', !!info.hull);
    ['end-l', 'end-r', 'end-t', 'end-b', 'mid-h', 'mid-v'].forEach(function (p) { cl.toggle(p, info.hull === p); });
    cl.toggle('reveal', !!info.reveal);
    cl.toggle('m-miss', info.shot === G.MISS);
    cl.toggle('m-hit', info.shot === G.HIT);
    cl.toggle('m-sunk', info.shot === G.SUNK);
    Object.keys(extra).forEach(function (k) { cl.toggle(k, !!extra[k]); });
  }
  function shotWord(v) { return v === G.MISS ? 'plask' : v === G.HIT ? 'ramt' : v === G.SUNK ? 'sænket' : 'ikke skudt på'; }

  function renderBig() {
    var s = run.state, n = run.n, ph = s.phase;
    var bigHome = ph === 'place' || view === 'home';
    var info, pv = placePreview(), ghost = {}, ghostOk = pv && pv.ok;
    if (pv && pv.cells) pv.cells.forEach(function (c) { ghost[c] = 1; });
    if (bigHome) info = seaClasses(s.home, s.home ? s.home.ships : s.fleet, true, false);
    else info = seaClasses(s.enemy, s.enemy.ships, false, ph === 'lost');
    var lastMine = bigHome ? freshAi : fresh;
    var canAim = !bigHome && ph === 'battle' && s.turn === 'player' && !busy && !paused;
    for (var i = 0; i < cellEls.length; i++) {
      var el = cellEls[i], inf = info[i];
      var shotDone = inf.shot !== G.NONE;
      var active = ph === 'place' ? live() : (canAim && !shotDone);
      applyCell(el, inf, {
        sel: i === aim && (ph === 'place' || canAim),
        aim: i === aim && canAim,
        last: i === lastMine && (bigHome ? s.lastAi === i : s.lastPlayer === i),
        chosen: ph === 'place' && inf.ship && inf.ship.id === selShip,
        'g-ok': ghost[i] && ghostOk, 'g-bad': ghost[i] && !ghostOk,
        fresh: (!bigHome && i === fresh) || (bigHome && i === freshAi),
        off: !active
      });
      if (active) { el.removeAttribute('aria-disabled'); el.removeAttribute('data-no-dwell'); el.tabIndex = 0; }
      else { el.setAttribute('aria-disabled', 'true'); el.setAttribute('data-no-dwell', ''); el.tabIndex = -1; }
      var label = G.coord(n, i) + ', ';
      if (bigHome) label += (inf.ship ? 'dit ' + shipLower(inf.ship) : 'vand') + (s.home ? ', ' + shotWord(inf.shot) : '');
      else label += shotWord(inf.shot) + (inf.ship && inf.shot === G.SUNK ? ' (' + shipLower(inf.ship) + ')' : '');
      if (ghost[i]) label += ghostOk ? ', skibet lægges her' : ', skibet kan ikke ligge her';
      if (i === aim && canAim) label += ', sigtet';
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    }
    boardEl.classList.toggle('home', bigHome);
    boardEl.classList.toggle('enemy', !bigHome);
  }
  function renderMini() {
    var s = run.state, bigHome = view === 'home';
    var info = bigHome ? seaClasses(s.enemy, s.enemy.ships, false, s.phase === 'lost')
                       : seaClasses(s.home, s.home ? s.home.ships : s.fleet, true, false);
    var last = bigHome ? (s.lastPlayer >= 0 ? s.lastPlayer : -1) : (s.lastAi >= 0 ? s.lastAi : -1);
    for (var i = 0; i < miniEls.length; i++) applyCell(miniEls[i], info[i], { last: i === last, fresh: i === (bigHome ? fresh : freshAi) });
    miniEl.classList.toggle('home', !bigHome);
    miniEl.classList.toggle('enemy', bigHome);
    $('#mini-title').textContent = bigHome ? 'Computerens hav' : 'Dit hav';
    $('#view-label').textContent = bigHome ? 'Vis computerens hav' : 'Vis dit hav stort';
    $('#btn-view').setAttribute('aria-label', bigHome ? 'Vis computerens hav stort' : 'Vis dit hav stort. Computerens skud er markeret på dit lille hav.');
  }
  function shipIcon(len, hits, sunk) {
    var h = '<span class="sicon' + (sunk ? ' sunk' : '') + '" aria-hidden="true">';
    for (var k = 0; k < len; k++) h += '<i class="' + (k === 0 ? 'e1' : k === len - 1 ? 'e2' : '') + (sunk ? ' x' : '') + '"></i>';
    void hits;
    return h + '</span>';
  }
  function renderFleet() {
    var s = run.state, ul = $('#enemy-fleet'), html = '';
    s.enemy.ships.forEach(function (sh) {
      html += '<li class="' + (sh.sunk ? 'sunk' : '') + '" aria-label="' + sh.name + ', ' + sh.len + ' felter, ' + (sh.sunk ? 'sænket' : 'ikke sænket') + '">' +
        shipIcon(sh.len, 0, sh.sunk) + '<span class="fname">' + sh.name + '</span><span class="fstate">' + (sh.sunk ? 'sænket' : sh.len + ' felter') + '</span></li>';
    });
    if (ul.dataset.html !== html) { ul.innerHTML = html; ul.dataset.html = html; }
    $('#fleet-title').textContent = 'Computerens skibe: ' + run.enemyLeft() + ' tilbage';
  }
  function renderShipList() {
    var list = $('#ship-list');
    if (!list.children.length || list.dataset.n !== String(G.FLEET.length)) {
      list.innerHTML = '';
      G.FLEET.forEach(function (d, k) {
        var b = document.createElement('button');
        b.className = 'btn option ship-btn';
        b.type = 'button';
        b.dataset.ship = d.id;
        b.innerHTML = shipIcon(d.len, 0, false) + '<span class="small">' + (k + 1) + '. ' + d.name + '</span>';
        b.addEventListener('click', function () { if (!swallowed(b)) chooseShip(d.id); });
        b.classList.add('turn-btn');
        list.appendChild(b);
      });
      list.dataset.n = String(G.FLEET.length);
    }
    $$('.ship-btn', list).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.ship === selShip));
      b.disabled = !live();
      var d = G.FLEET.filter(function (f) { return f.id === b.dataset.ship; })[0];
      b.setAttribute('aria-label', d.name + ', ' + d.len + ' felter' + (b.dataset.ship === selShip ? ', valgt' : ''));
    });
  }

  var lastPhaseKey = '';
  function refresh(relayout) {
    if (!run) return;
    var s = run.state, ph = s.phase;
    var shownPhase = ph === 'won' || ph === 'lost' ? (busy ? 'battle' : 'end') : ph;
    gameEl.dataset.phase = shownPhase;
    gameEl.dataset.view = ph === 'place' ? 'home' : view;
    $('#hud-match').textContent = s.match;
    $('#hud-score').textContent = s.score;
    $('#hud-shots').textContent = s.shots;
    $('#hud-best').textContent = Math.max(records.best(catOf(s.level, s.sizeId)), s.score);
    renderBig();
    renderMini();
    renderFleet();
    renderShipList();

    // Overskrift over brættet: hvis hav, og hvis tur
    var title = $('#board-title'), tcls = '';
    if (ph === 'place') title.textContent = 'Dit hav – kamp ' + s.match;
    else if (busy && s.turn === 'ai') { title.textContent = 'Computerens tur'; tcls = 'ai'; }
    else if (ph === 'won') { title.textContent = busy ? 'Computerens hav' : 'Du vandt kamp ' + s.match + '!'; tcls = busy ? '' : 'won'; }
    else if (ph === 'lost') { title.textContent = busy ? 'Dit hav' : 'Computeren vandt – her lå dens skibe'; tcls = busy ? 'ai' : 'lost'; }
    else if (view === 'enemy') { title.textContent = 'Computerens hav – din tur'; tcls = 'you'; }
    else title.textContent = 'Dit hav';
    title.className = 'board-title' + (tcls ? ' ' + tcls : '');

    // Tip
    var hint = $('#hint'), txt = '', cls = '';
    if (ph === 'place') {
      var pv = placePreview();
      if (note && !selShip) txt = note + ' Tryk Start kamp, når du er klar.';
      else if (!selShip) txt = 'Skibene ligger tilfældigt. Tryk Start kamp eller Bland igen – eller vælg et skib for at flytte det.';
      else if (!pv || samePlace(pv)) txt = 'Vælg feltet til stævnen, og vælg vandret eller lodret. Tryk så Læg.';
      else if (!pv.ok) { txt = 'Skibet kan ikke ligge her – skibe må ikke røre hinanden. Vælg et andet felt eller en anden retning.'; cls = 'bad'; }
      else { txt = 'Passer! Tryk Læg for at lægge skibet på ' + G.coord(run.n, pv.cells[0]) + '.'; cls = 'ok'; }
    } else if (busy && s.turn === 'ai') { txt = (note ? note + ' ' : '') + aiNote; cls = 'ai'; }
    else if (ph === 'battle') {
      if (view === 'home') txt = (aiNote || 'Dit hav.') + ' Tryk på det lille hav for at skyde igen.';
      else if (aim >= 0) { txt = 'Sigter på ' + G.coord(run.n, aim) + '. Tryk Skyd.'; cls = 'ok'; }
      else txt = (aiNote ? aiNote + ' ' : (note ? note + ' ' : '')) + 'Din tur: vælg et felt.';
    } else txt = note;
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');

    var canFire = live() && ph === 'battle' && view === 'enemy' && s.turn === 'player' && aim >= 0;
    $('#btn-fire').disabled = !canFire;
    $('#fire-sub').textContent = aim >= 0 && view === 'enemy' && ph === 'battle' ? G.coord(run.n, aim) : (busy ? 'vent' : 'vælg et felt');
    $('#btn-view').disabled = paused || ph === 'place';
    var pv2 = placePreview();
    $('#btn-place').disabled = !(live() && pv2 && pv2.ok && !samePlace(pv2));
    $('#btn-shuffle').disabled = !live() || ph !== 'place';
    $('#btn-begin').disabled = !live() || ph !== 'place';
    $$('[data-orient]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.orient === orient));
      b.disabled = !live() || ph !== 'place' || !selShip;
    });
    boardEl.setAttribute('aria-label', title.textContent + '. ' + txt);
    renderEnd();

    var key = shownPhase + '|' + run.n;
    if (current === 'game' && (relayout || key !== lastPhaseKey)) { lastPhaseKey = key; layoutGame(); }
    else if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // Slut på en kamp: tekst og knap står ved siden af (eller under) brættet, så havet kan ses.
  function renderEnd() {
    var s = run.state, box = $('#end-box');
    if (!(s.phase === 'won' || s.phase === 'lost')) return;
    var ul = $('#end-points'), html = '';
    if (s.phase === 'won') {
      var mp = s.matchPoints;
      $('#end-title').textContent = 'Du vandt kamp ' + s.match + '!';
      $('#end-text').textContent = 'Du sænkede alle fem skibe med ' + shotsText(s.shots) + '.';
      html += '<li><span>5 skibe sænket</span><b>' + pointsText(5 * G.RULES.sunkPoint) + '</b></li>';
      html += '<li><span>Vundet kamp</span><b>' + pointsText(mp.win) + '</b></li>';
      html += '<li><span>' + mp.unshot + ' felter uden skud</span><b>' + pointsText(mp.unshotPoints) + '</b></li>';
      html += '<li class="sum"><span>I alt nu</span><b>' + pointsText(s.score) + '</b></li>';
      $('#btn-end-label').textContent = 'Næste kamp';
      $('#btn-end-sub').textContent = 'Kamp ' + (s.match + 1);
    } else {
      $('#end-title').textContent = 'Computeren vandt';
      $('#end-text').textContent = 'Computeren sænkede hele din flåde med ' + shotsText(s.aiShots) + '. De stiplede skibe er dem, du ikke fandt.';
      html += '<li><span>' + winsText(s.wins) + '</span><b>' + pointsText(s.score) + '</b></li>';
      $('#btn-end-label').textContent = 'Se resultat';
      $('#btn-end-sub').textContent = pointsText(s.score);
    }
    if (ul.innerHTML !== html) ul.innerHTML = html;
    box.classList.toggle('lost', s.phase === 'lost');
  }
  $('#btn-end').addEventListener('click', function () { if (!swallowed(this)) endAction(); });
  $('#btn-end').classList.add('turn-btn');

  $('#btn-fire').classList.add('turn-btn');
  $('#btn-place').classList.add('turn-btn');
  $('#btn-fire').addEventListener('click', function () { if (!swallowed(this)) shoot(); });
  $('#btn-place').addEventListener('click', function () { if (!swallowed(this)) placeShip(); });
  $('#btn-shuffle').addEventListener('click', function () { shuffle(); });
  $('#btn-begin').addEventListener('click', function () { beginBattle(); });
  $('#btn-view').addEventListener('click', function () { toggleView(); });
  $$('[data-orient]').forEach(function (b) { b.addEventListener('click', function () { chooseOrient(b.dataset.orient); }); });

  function setPaused(p) {
    if (!run || current !== 'game' || phase() === 'won' || phase() === 'lost') return;
    if (paused === p) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) { clearTimeout(aiTimer); fitScreen($('#pause-overlay')); }
    else if (busy && run.state.turn === 'ai') scheduleAi();
    dwell.reset();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); quitToMenu(); });
  function quitToMenu() { clearTimeout(aiTimer); clearTimeout(endTimer); run = null; paused = false; busy = false; $('#pause-overlay').hidden = true; show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished || !run) return;
    finished = true;
    var s = run.state, cat = catOf(s.level, s.sizeId), rankText = '';
    lastEntryId = null;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (s.score > 0) {
      var res = records.add(cat, s.score, { wins: s.wins, sunk: s.sunkTotal });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    $('#go-reason').textContent = 'Computeren sænkede hele din flåde i kamp ' + s.match + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = winsText(s.wins) + ' · ' + (s.sunkTotal === 1 ? '1 skib' : s.sunkTotal + ' skibe') + ' sænket · ' + shotsText(s.totalShots) + ' i alt';
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = catName(s.level, s.sizeId);
    $('#go-records-title').textContent = 'Rekorder – ' + catName(s.level, s.sizeId);
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
        lv.textContent = ' · ' + winsText(typeof e.wins === 'number' ? e.wins : 0);
        sc.appendChild(lv);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder (pr. sværhedsgrad og havets størrelse) ----------
  var recLevel = G.DEFAULT_LEVEL, recSize = G.DEFAULT_SIZE;
  function openRecords(level, size) { recLevel = level; recSize = size; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recLevel === recLevel)); });
    $$('#records [data-rec-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recSize === recSize)); });
    $('#rec-title').textContent = 'Rekorder – ' + catName(recLevel, recSize);
    renderRecordList($('#rec-list'), catOf(recLevel, recSize), null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-level]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recLevel = b.dataset.recLevel; syncRecords(); });
  });
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
    var n = run.n, ph = phase();
    if (ph === 'battle' && view !== 'enemy') return;
    var free = function (i) { return ph === 'place' || run.state.enemy.shots[i] === G.NONE; };
    var i = aim;
    if (i < 0) {
      // Start i midten (eller nærmeste frie felt)
      var mid = Math.floor(n / 2) * n + Math.floor((n - 1) / 2), best = -1, bd = 1e9;
      for (var k = 0; k < n * n; k++) if (free(k)) {
        var dd = Math.abs(k % n - mid % n) + Math.abs(Math.floor(k / n) - Math.floor(mid / n));
        if (dd < bd) { bd = dd; best = k; }
      }
      if (best >= 0) pickCell(best);
      return;
    }
    // Spring over felter, der allerede er skudt på
    var x = i % n, y = Math.floor(i / n);
    for (var step = 0; step < n; step++) {
      x += d[0]; y += d[1];
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      if (free(y * n + x)) { pickCell(y * n + x); return; }
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, ph = phase(), handled = true;
    if (ph === 'won' || ph === 'lost') {
      if ((k === 'Enter' || k === ' ') && !busy && !e.repeat) endAction();
      else if (k === 'v' && !e.repeat) toggleView();
      else handled = false;
    } else if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) { if (ph === 'place') placeShip(); else shoot(); } }
    else if (k === 'v') { if (!e.repeat) toggleView(); }
    else if (ph === 'place' && k === 'r') { if (!e.repeat && selShip) chooseOrient(orient === 'h' ? 'v' : 'h'); }
    else if (ph === 'place' && k === 'b') { if (!e.repeat) shuffle(); }
    else if (ph === 'place' && k === 's') { if (!e.repeat) beginBattle(); }
    else if (ph === 'place' && k >= '1' && k <= '5') { if (!e.repeat) chooseShip(G.FLEET[+k - 1].id); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Brættet skal være så stort som muligt. Knapperne er mindst ca. 3 cm, når
  // der er plads (samme regel som arkade.css), ellers så store som muligt.
  // Tre layout prøves, og det med de største felter vælges:
  //   wide:  status og flåde | stort hav | lille hav, tip og Skyd
  //   side:  stort hav | (status, flåde, lille hav, tip og knapper)   – lave skærme
  //   below: status øverst, stort hav, lille hav og knapper under    – højkant
  var FRAME = 6, LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { return Math.max(3 * PX_CM, Math.min(0.15 * Math.min(W, H), 4.2 * PX_CM)); }
  function cssGap(W, H) { return Math.max(0.8 * PX_CM, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.014), g: Math.max(8, Math.min(26, mn * 0.02)) }; }
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function labFor(cell) { return Math.round(Math.max(14, Math.min(40, cell * 0.36))); }

  function setVars(lay, b, cell, v, n, extra) {
    var d = spacing(v.W, v.H), st = gameEl.style;
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    var lab = labFor(cell);
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(8, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', d.p + 'px');
    st.setProperty('--game-gap', d.g + 'px');
    st.setProperty('--cell', cell + 'px');
    st.setProperty('--lab', lab + 'px');
    st.setProperty('--board-px', (lab + n * cell + FRAME) + 'px');
    st.setProperty('--side-w', Math.floor(extra.sideW || 300) + 'px');
    st.setProperty('--panel-w', Math.floor(extra.panelW || 300) + 'px');
    st.setProperty('--mini-cell', Math.max(6, Math.floor(extra.mini || 20)) + 'px');
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function sideH(el) { return el.scrollHeight; }
  // Prøv ét layout med knapstørrelse b. Giver feltstørrelsen, eller 0 hvis siderne ikke kan være der.
  function tryLayout(lay, b, v, n) {
    var d = spacing(v.W, v.H), p = d.p, g = d.g, W = v.W - 2 * p, H = v.H - 2 * p;
    var L = $('.side-left', gridEl), R = $('.side-right', gridEl), T = $('#board-title');
    var cell, extra = {};
    if (lay === 'wide') {
      var sideW = Math.max(250, Math.min(460, b * 2.5, W * 0.25));
      extra.sideW = sideW;
      extra.mini = (sideW - 40) / (n + 0.2);
      setVars(lay, b, 60, v, n, extra);
      // Det lille hav må ikke gøre højre side for høj
      var rh = sideH(R);
      if (rh > H) { extra.mini = Math.max(8, extra.mini - (rh - H) / n - 1); setVars(lay, b, 60, v, n, extra); }
      if (sideH(L) > H || sideH(R) > H) return null;
      var th = T.offsetHeight + 6;
      cell = Math.floor(Math.min((W - 2 * sideW - 2 * g - FRAME) / (n + 0.36), (H - th - FRAME) / (n + 0.36)));
    } else if (lay === 'side') {
      // Panelet får al den bredde, brættet ikke kan bruge (brættet er bundet af højden).
      // Kan siderne ikke være der, gøres panelet bredere, så knapperne kan stå på færre rækker.
      extra.mini = 0;
      setVars(lay, b, 40, v, n, { panelW: 3 * b + 16, mini: 10 });
      var th2 = T.offsetHeight + 6;
      var cellH = Math.floor((H - th2 - FRAME) / (n + 0.36));
      var minPanel = 3 * b + 16, panelW = Math.max(minPanel, W - g - (labFor(cellH) + n * cellH + FRAME) - 2);
      var fit = false;
      for (var k2 = 0; k2 < 12 && panelW <= W * 0.62; k2++) {
        extra.panelW = panelW; extra.mini = Math.min(b * 1.25, panelW * 0.4) / n;
        setVars(lay, b, 40, v, n, extra);
        if (sideH(L) + sideH(R) + g <= H) { fit = true; break; }
        panelW = Math.round(panelW + Math.max(24, b * 0.5));
      }
      if (!fit) return null;
      cell = Math.floor(Math.min((W - extra.panelW - g - FRAME) / (n + 0.36), (H - th2 - FRAME) / (n + 0.36)));
    } else {
      extra.panelW = W; extra.mini = Math.min(b * 1.25, W * 0.4) / n;
      setVars(lay, b, 40, v, n, extra);
      var used = sideH(L) + sideH(R) + T.offsetHeight + 6 + 2 * g;
      cell = Math.floor(Math.min((W - FRAME) / (n + 0.36), (H - used - FRAME) / (n + 0.36)));
    }
    if (!(cell >= 16)) return null;
    // Mindste side: på smalle skærme må panelet ikke være bredere end brættet
    if (lay !== 'wide') extra.panelW = lay === 'below' ? W : extra.panelW;
    return { lay: lay, b: b, cell: cell, extra: extra };
  }
  function bestLayout(v, n) {
    var small = isSmall(v), floor = small ? SMALL_MIN : 80, base = Math.max(floor, cssBtn(v.W, v.H));
    var found = {};
    LAYOUTS.forEach(function (lay) {
      // Knapperne skrumper kun, hvis siderne ellers ikke kan være der.
      // Men felter under 3 cm byttes gerne for knapper ned til ca. 2,4 cm.
      var b = base, res = null, best = null;
      for (var k = 0; k < 14; k++) {
        res = tryLayout(lay, b, v, n);
        if (res && (!best || res.cell > best.cell * 1.06)) best = res;
        if (res && res.cell >= 2.6 * PX_CM) break;
        if (best && b < 2.4 * PX_CM && best.b >= 2.4 * PX_CM) break;
        if (b <= floor) break;
        b = Math.max(floor, b * 0.93);
      }
      if (best) found[lay] = best;
    });
    var pick = null;
    LAYOUTS.forEach(function (l) { if (found[l] && (!pick || found[l].cell > pick.cell * 1.04)) pick = found[l]; });
    if (pick && found.wide && found.wide.cell >= pick.cell * 0.94) pick = found.wide;
    return pick;
  }
  function layoutGame() {
    if (!run) return;
    var v = viewport(), n = run.n;
    gameEl.classList.toggle('mini-mode', false);
    var res = bestLayout(v, n);
    if (!res) res = { lay: 'below', b: SMALL_MIN, cell: 16, extra: { panelW: v.W - 16, mini: 8 } };
    var cell = res.cell;
    setVars(res.lay, res.b, cell, v, n, res.extra);
    // Sikkerhedsnet: passer det ikke helt, bliver felterne lidt mindre
    for (var t = 0; t < 40 && (overflows(gameEl) || overflows(root)) && cell > 16; t++) {
      cell = Math.max(16, Math.floor(cell * 0.97));
      setVars(res.lay, res.b, cell, v, n, res.extra);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }
  // Feltstørrelse for et bræt på denne skærm (bruges af startskærmen): spillet lægges ud usynligt.
  var cellCache = {};
  function cellSizeFor(sizeId) {
    var v = viewport(), key = sizeId + '@' + v.W + 'x' + v.H;
    if (cellCache[key]) return cellCache[key];
    var saveRun = run, wasHidden = gameEl.hidden, saveView = view, saveKey = lastPhaseKey;
    run = G.createRun(sizeId, sset.get('level'), { rng: function () { return 0.37; } });
    run.begin(); // målt i kamp, hvor siderne er størst
    view = 'enemy';
    gameEl.style.visibility = 'hidden'; gameEl.hidden = false;
    var prevBuilt = builtN;
    buildBoard(run.n);
    var cur = current; current = 'measure';
    refresh();
    current = cur;
    layoutGame();
    var px = parseFloat(gameEl.dataset.cell) || 0;
    run = saveRun; view = saveView; lastPhaseKey = saveKey;
    gameEl.hidden = wasHidden; gameEl.style.visibility = '';
    if (run) { buildBoard(run.n); refresh(); if (current === 'game') layoutGame(); }
    else builtN = prevBuilt === builtN ? builtN : builtN;
    cellCache[key] = px;
    return px;
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil), er det en lille skærm. Her
  // bliver knapperne aldrig mindre end SMALL_MIN, og der zoomes ikke. Er der
  // ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('bk-lille', small);
    root.classList.toggle('bk-tvaers', small && v.W > v.H);
  }

  // Sider: blokkene (data-trin) fordeles på så få sider, som der er plads til.
  function makePager(screen, opts) {
    var nav = document.createElement('div');
    nav.className = 'trin-nav';
    nav.hidden = true;
    nav.innerHTML = '<button class="btn trin-prev" aria-label="Forrige side"><span class="icon" aria-hidden="true">‹</span><span class="big">Forrige</span></button>' +
      '<span class="trin-label" aria-live="polite"></span>' +
      '<button class="btn trin-next" aria-label="Næste side"><span class="icon" aria-hidden="true">›</span><span class="big">Næste</span></button>';
    opts.navIn.appendChild(nav);
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
      reset: function () {
        opts.all().forEach(function (el) { setHidden(el, false); });
        nav.hidden = true; pages = [];
        placeNav();
      },
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

  // Game over på en lille skærm: resultatet og rekordlisten på hver sin side.
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

  // De andre skærme (og pauseboksen) tilpasses vinduet, til alt kan ses:
  // 1) mindre knapper og afstande, 2) valgfri tekst skjules, 3) flere sider,
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
    cellCache = {};
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
  window.Soeslag = {
    get run() { return run; }, get view() { return view; }, get aim() { return aim; }, get busy() { return busy; },
    settings: arkade, gameSettings: sset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, pickCell: pickCell, shoot: shoot, aiTurn: aiTurn, toggleView: toggleView,
    chooseShip: chooseShip, chooseOrient: chooseOrient, placeShip: placeShip, shuffle: shuffle, begin: beginBattle,
    endAction: endAction, refresh: refresh, layout: layoutGame, cellSizeFor: cellSizeFor, gameOver: gameOver,
    boardSize: boardSize
  };
})();
