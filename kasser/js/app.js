/*
 * Kasser – brugerflade: skærme, input, indstillinger, lyd, animation, banevalg og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil i Hojt Arkade.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.KasserGame;
  var N = G.count();

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // dwellRepeat: false = ét dwell er ét skridt (blikket skal væk fra pilen og tilbage); true = gentag ved fortsat blik
  // glow: neonglød til/fra (temaets glød-faktor --glow; se tema/neon/tema.css)
  var ks = ArkadeSettings.create('kasser', { stuckWarning: true, dwellRepeat: false, glow: true });
  // Det visuelle tema: grafik og tokens fra tema/<navn>/ (indtil videre kun neon)
  var tema = KasserTema.hent('neon');
  var records = ArkadeHighscores.create('kasser', { max: 10 });
  var CATEGORY = 'runde';
  var progress = G.createProgress(window.localStorage);

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul. Kasser bruger disse navne:
  var SFX = { move: 'move', push: 'move', goal: 'eat', solved: 'bonus', bump: 'obstacle', stuck: 'bonusGone',
              undo: 'click', restart: 'pause', record: 'record', click: 'click', pause: 'pause' };
  function sfx(name) { audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true); // TD Browse m.fl. kan klikke uden pointerdown
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  var T = {};   // temaets tokens (farver, stregtykkelser, glød), læst fra CSS
  function readColors() {
    root.classList.toggle('ks-gloed-fra', !ks.get('glow'));
    T = KasserRender.readTokens(tema, cssVar, getComputedStyle(document.body).fontFamily || 'sans-serif');
  }
  // Knappernes ikoner hentes fra temaet via navn (data-ikon="...")
  $$('[data-ikon]').forEach(function (el) { el.innerHTML = tema.ikoner[el.getAttribute('data-ikon')] || ''; });
  // Pilene: ét skridt pr. dwell, eller gentagelse ved fortsat blik (indstilling)
  function syncDwellRepeat() {
    $$('.arrow').forEach(function (a) { a.toggleAttribute('data-dwell-repeat', !!ks.get('dwellRepeat')); });
    dwell.reset();
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
    root.classList.toggle('ks-anim', animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og en kort glidning pr. felt. Fra får brikkerne til at hoppe direkte';
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
    fitScreen();
  });
  ks.onChange(function () { syncSettingsUi(); });

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'game') layoutGame();
    if (id === 'menu') syncMenu();
    if (id === 'levels') syncLevels();
    fitScreen();
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function n1(n, one, many) { return n === 1 ? '1 ' + one : n + ' ' + many; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function roundText() {
    return progress.roundActive()
      ? 'Runden: ' + fmt(progress.roundTotal()) + ' point · ' + n1(progress.roundLevels(), 'bane', 'baner')
      : 'Ingen runde i gang – løs en bane for at starte en';
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var next = progress.nextLevel();
    $('#continue-sub').textContent = 'Bane ' + (next + 1) + ' af ' + N;
    var solved = progress.solvedCount();
    $('#menu-note').textContent = (solved ? n1(solved, 'bane', 'baner') + ' løst af ' + N + '. ' : N + ' baner. ') + roundText() + '.';
  }
  $('#btn-continue').addEventListener('click', function () { sfx('click'); startLevel(progress.nextLevel()); });
  $('#btn-levels').addEventListener('click', function () { sfx('click'); openLevels('menu'); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  var leaving = false;
  function goToHall() {
    if (leaving) return;
    leaving = true;
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, ks].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pagehide', function () { try { audio.setMusic(false); } catch (e) { /* ingen lyd */ } });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { leaving = false; audio.setSfx(arkade.get('sound')); audio.setMusic(arkade.get('music')); }
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
  function onFs() { syncFullscreen(); layoutGame(); fitScreen(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Banevalg ----------
  var PER_PAGE = 8, page = 0, levelsReturn = 'menu';
  function pages() { return Math.ceil(N / PER_PAGE); }
  function openLevels(from) {
    levelsReturn = from || 'menu';
    page = Math.floor((run ? run.state.level : progress.nextLevel()) / PER_PAGE);
    show('levels');
  }
  function syncLevels() {
    page = Math.max(0, Math.min(pages() - 1, page));
    var grid = $('#level-grid'), next = progress.nextLevel();
    grid.innerHTML = '';
    for (var i = page * PER_PAGE; i < Math.min(N, (page + 1) * PER_PAGE); i++) {
      var b = document.createElement('button'), best = progress.best(i), open = progress.isUnlocked(i);
      b.className = 'btn level-btn' + (best ? ' done' : '') + (i === next ? ' current' : '');
      b.dataset.level = i;
      b.setAttribute('role', 'listitem');
      var sub = best ? '✓ ' + best.moves + ' træk' : open ? 'Par ' + window.KasserBaner[i].par : 'Låst';
      b.innerHTML = '<span class="lvl-num"></span><span class="small"></span>';
      b.querySelector('.lvl-num').textContent = i + 1;
      b.querySelector('.small').textContent = sub;
      b.setAttribute('aria-label', 'Bane ' + (i + 1) + ', ' + (best ? 'løst på ' + best.moves + ' træk, par ' + window.KasserBaner[i].par : open ? 'par ' + window.KasserBaner[i].par : 'låst'));
      if (!open) b.disabled = true;
      (function (n) { b.addEventListener('click', function () { sfx('click'); startLevel(n); }); })(i);
      grid.appendChild(b);
    }
    $('#page-info').textContent = 'Side ' + (page + 1) + ' af ' + pages();
    $('#btn-page-prev').disabled = page === 0;
    $('#btn-page-next').disabled = page >= pages() - 1;
    $('#round-info').textContent = roundText();
    $('#btn-end-round').disabled = !progress.roundActive();
    dwell.reset();
  }
  $('#btn-page-prev').addEventListener('click', function () { sfx('click'); page--; syncLevels(); fitScreen(); });
  $('#btn-page-next').addEventListener('click', function () { sfx('click'); page++; syncLevels(); fitScreen(); });
  $('#btn-levels-back').addEventListener('click', function () {
    sfx('click');
    if (levelsReturn === 'game' && run) { show('game'); refresh(); } else show('menu');
  });
  $('#btn-end-round').addEventListener('click', function () { sfx('click'); endRound(); });

  // ---------- Spillet ----------
  var run = null, paused = false, boardCanvas = $('#board');
  var anim = null, hoverDir = null, bumpTimer = 0, stuckShown = false;
  var DIR_NAMES = { up: 'op', down: 'ned', left: 'til venstre', right: 'til højre' };
  var STEP_MS = 150;

  function startLevel(n) {
    if (!run && window.ArkadeHighscore) ArkadeHighscore.start();
    cancelAnim();
    run = G.createLevel(n);
    progress.setLast(n);
    paused = false; stuckShown = false;
    hideOverlays();
    show('game');
    refresh();
    $('#board-status').textContent = 'Bane ' + (n + 1) + '. ' + n1(run.state.boxes.length, 'kasse', 'kasser') + '. Par ' + run.state.par + ' træk.';
  }
  function hideOverlays() { ['#pause-overlay', '#solved-overlay'].forEach(function (s) { $(s).hidden = true; }); }
  function busy() { return !!anim; }
  function canPlay() { return run && current === 'game' && !paused && !busy() && !run.state.solved; }

  function viewFromState(extra) {
    var s = run.state;
    var v = {
      w: s.w, h: s.h, cell: s.cell, goal: s.goal,
      boxes: s.boxes.map(function (i) { var p = run.xy(i); return { x: p.x, y: p.y, i: i }; }),
      player: (function () { var p = run.xy(s.player); return { x: p.x, y: p.y, dir: s.dir }; })(),
      stuck: ks.get('stuckWarning') ? run.stuckBoxes() : []
    };
    if (extra) for (var k in extra) v[k] = extra[k];
    return v;
  }
  function previewFor(dir) {
    var c = run.check(dir);
    if (c.kind === 'wall') return null;
    var t = run.xy(c.to), pv = { x: t.x, y: t.y, dir: dir, ok: c.kind !== 'box' };
    if (c.kind === 'push' || c.kind === 'box') { var b = run.xy(c.boxTo); pv.boxTo = { x: b.x, y: b.y }; }
    return pv;
  }
  function drawBoard() {
    if (!run || anim) return;
    var extra = {};
    if (hoverDir && canPlay()) extra.preview = previewFor(hoverDir);
    KasserRender.draw(boardCanvas, viewFromState(extra), tema, T);
  }
  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-level').textContent = 'Bane ' + (s.level + 1) + ' af ' + N;
    $('#hud-moves').textContent = s.moves;
    var best = progress.best(s.level);
    $('#hud-par').textContent = (s.moves === 1 ? 'træk' : 'træk') + ' · par ' + s.par + (best ? ' · bedst ' + best.moves : '');
    $('#btn-undo').disabled = !run.canUndo();
    $('#btn-restart').disabled = s.moves === 0 && !run.canUndo();
    $$('.arrow').forEach(function (b) {
      var d = b.dataset.dir, c = run.check(d).kind, name = DIR_NAMES[d];
      b.setAttribute('aria-label', 'Gå ' + name + (c === 'push' ? ' og skub kassen' : c === 'wall' ? ' (væg)' : c === 'box' ? ' (kassen kan ikke flyttes)' : ''));
    });
    syncStuck();
    drawBoard();
  }
  function syncStuck() {
    var stuck = ks.get('stuckWarning') && run && !run.state.solved ? run.stuckBoxes() : [];
    var note = $('#stuck-note');
    note.hidden = stuck.length === 0;
    $('#btn-undo').classList.toggle('suggest', stuck.length > 0);
    if (stuck.length && !stuckShown) {
      $('#stuck-msg').textContent = (stuck.length === 1 ? 'En kasse sidder fast' : stuck.length + ' kasser sidder fast') + ' – tryk på Fortryd';
      sfx('stuck');
      $('#board-status').textContent = $('#stuck-msg').textContent;
    }
    stuckShown = stuck.length > 0;
    if (stuckShown) fitNote();
  }
  // Beskeden står i sin egen stribe under brættet (se layoutGame) og må ikke blive bredere
  // end striben: skriften gøres lidt mindre, hvis det er nødvendigt.
  function fitNote() {
    var note = $('#stuck-note'), msg = $('#stuck-msg');
    if (note.hidden) return;
    msg.style.fontSize = '';
    var fs = parseFloat(getComputedStyle(msg).fontSize);
    while (fs > 10 && (msg.offsetWidth > note.clientWidth || msg.offsetHeight > note.clientHeight)) {
      fs -= 1; msg.style.fontSize = fs + 'px';
    }
  }
  // Højden på stribe til beskeden (0, hvis advarslen er slået fra)
  function noteStrip() {
    if (!ks.get('stuckWarning')) return { h: 0, gap: 0 };
    var fs = parseFloat(getComputedStyle(root).fontSize) || 18;
    return { h: Math.ceil(fs * 0.95 * 1.25 + fs * 0.95 * 0.6 + 6), gap: Math.max(6, Math.round(fs * 0.4)) };
  }

  // Et eller flere skridt (fra pil, tast eller tryk på et felt) – animeres ét felt ad gangen.
  function playSteps(steps) {
    if (!steps.length) return;
    if (!animationOn()) { finishSteps(steps); return; }
    var s = run.state, k = 0;
    // Tegn baglæns fra den endelige stilling: positionerne før hvert skridt.
    var boxesNow = s.boxes.slice();
    var boxesBefore = [];
    for (var i = steps.length - 1; i >= 0; i--) {
      boxesBefore[i] = boxesNow.slice();
      if (steps[i].pushed) { var bi = boxesNow.indexOf(steps[i].box.to); boxesBefore[i][bi] = steps[i].box.from; boxesNow = boxesBefore[i]; }
      else boxesBefore[i] = boxesNow.slice();
    }
    anim = { t0: performance.now(), raf: 0 };
    function frame(now) {
      if (!anim) return;
      var st = steps[k], t = Math.min(1, (now - anim.t0) / STEP_MS), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var a = run.xy(st.from), b = run.xy(st.to);
      var v = viewFromState({ stuck: [] });
      v.player = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, dir: st.dir };
      v.boxes = boxesBefore[k].map(function (i) {
        var p = run.xy(i);
        if (st.pushed && i === st.box.from) { var q = run.xy(st.box.to); return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, i: i, moving: true }; }
        return { x: p.x, y: p.y, i: i };
      });
      KasserRender.draw(boardCanvas, v, tema, T);
      if (t >= 1) {
        stepSound(st);
        k++;
        if (k >= steps.length) { anim = null; finishSteps(steps, true); return; }
        anim.t0 = now;
      }
      anim.raf = requestAnimationFrame(frame);
    }
    anim.raf = requestAnimationFrame(frame);
  }
  function stepSound(st) {
    if (st.solved) return;
    if (st.pushed && st.box.onGoal) sfx('goal'); else sfx(st.pushed ? 'push' : 'move');
  }
  function finishSteps(steps, soundsDone) {
    if (!soundsDone) stepSound(steps[steps.length - 1]);
    refresh();
    var last = steps[steps.length - 1];
    // dwell nulstilles ikke her: uden gentagelse skal blikket forlade pilen før næste skridt
    if (run.state.solved) { dwell.reset(); solved(); return; }
    var on = run.boxesOnGoal(), all = run.state.boxes.length;
    $('#board-status').textContent = run.state.moves + ' træk. ' + on + ' af ' + all + ' kasser er på plads.' + (last.pushed && last.box.onGoal ? ' Kassen er på et mål.' : '');
  }
  function move(dir) {
    if (!canPlay()) return;
    var res = run.move(dir);
    if (res.ignored) return;
    if (!res.moved) { bump(dir, res); return; }
    playSteps([res]);
  }
  function walkTo(x, y) {
    if (!canPlay()) return;
    var r = run.walkTo(x, y);
    if (r.bump) { bump(r.bump.dir, r.bump); return; }
    if (!r.steps.length) {
      if (r.unreachable) $('#board-status').textContent = 'Der kan du ikke gå hen uden at skubbe en kasse.';
      return;
    }
    playSteps(r.steps);
  }
  function bump(dir, res) {
    sfx('bump');
    var btn = $('.arrow[data-dir="' + dir + '"]');
    if (btn) { btn.classList.remove('bumped'); void btn.offsetWidth; btn.classList.add('bumped'); clearTimeout(bumpTimer); bumpTimer = setTimeout(function () { btn.classList.remove('bumped'); }, 300); }
    $('#board-status').textContent = res.bump === 'wall' ? 'Der er en væg ' + DIR_NAMES[dir] + '. Det koster ikke et træk.'
      : res.behind === 'box' ? 'To kasser i træk kan ikke skubbes. Det koster ikke et træk.'
      : 'Kassen står mod en væg og kan ikke skubbes ' + DIR_NAMES[dir] + '. Det koster ikke et træk.';
    refresh();
  }
  function cancelAnim() {
    if (anim && anim.raf) cancelAnimationFrame(anim.raf);
    anim = null; clearTimeout(bumpTimer);
  }
  function undo() {
    if (!run || current !== 'game' || paused || busy() || run.state.solved) return;
    if (run.undo()) { sfx('undo'); stuckShown = run.stuckBoxes().length > 0 && stuckShown; refresh(); $('#board-status').textContent = 'Fortrudt. ' + run.state.moves + ' træk.'; }
  }
  function restart() {
    if (!run || current !== 'game' || paused || busy() || run.state.solved) return;
    if (run.restart()) { sfx('restart'); stuckShown = false; refresh(); $('#board-status').textContent = 'Banen er startet forfra. Fortryd bringer dig tilbage.'; }
  }

  function showOverlay(id, focusId) {
    $(id).hidden = false;
    fitScreen();
    $(focusId).focus({ preventScroll: true });
  }
  var lastSolve = null;
  function solved() {
    var s = run.state, pts = run.points(), res = progress.record(s.level, s.moves, pts);
    lastSolve = res;
    sfx('solved');
    $('#solved-title').textContent = s.moves <= s.par ? 'Løst på par!' : 'Banen er løst!';
    $('#solved-score').textContent = pts + ' point';
    $('#solved-moves').textContent = s.moves + ' træk · par ' + s.par + (res.newBest && res.prevMoves ? ' · ny personlig rekord' : '');
    $('#solved-round').textContent = (res.gained > 0
      ? (res.roundBefore ? '+' + res.gained + ' point til runden (forbedring). ' : '')
      : 'Runden har allerede ' + res.roundBefore + ' point for denne bane. ') + 'Runden: ' + fmt(res.roundTotal) + ' point.';
    var last = s.level >= N - 1;
    $('#btn-next').hidden = last;
    $('#btn-next-sub').textContent = 'Bane ' + (s.level + 2);
    showOverlay('#solved-overlay', last ? '#btn-solved-levels' : '#btn-next');
    $('#board-status').textContent = $('#solved-title').textContent + ' ' + pts + ' point.';
  }
  $('#btn-next').addEventListener('click', function () { if (!run) return; sfx('click'); startLevel(Math.min(N - 1, run.state.level + 1)); });
  $('#btn-replay').addEventListener('click', function () { if (!run) return; sfx('click'); startLevel(run.state.level); });
  $('#btn-solved-levels').addEventListener('click', function () { sfx('click'); $('#solved-overlay').hidden = true; run = null; openLevels('menu'); });

  $$('.arrow').forEach(function (b) {
    b.addEventListener('click', function () { move(b.dataset.dir); });
    function on() { hoverDir = b.dataset.dir; drawBoard(); }
    function off() { if (hoverDir === b.dataset.dir) { hoverDir = null; drawBoard(); } }
    b.addEventListener('pointerenter', on);
    b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on);
    b.addEventListener('blur', off);
  });
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-restart').addEventListener('click', restart);
  // Tryk eller klik på et felt: gå dertil (eller skub kassen ved siden af)
  boardCanvas.addEventListener('click', function (e) {
    if (!run) return;
    var r = boardCanvas.getBoundingClientRect(), s = run.state;
    var S = Math.min(r.width / s.w, r.height / s.h), ox = (r.width - S * s.w) / 2, oy = (r.height - S * s.h) / 2;
    var x = Math.floor((e.clientX - r.left - ox) / S), y = Math.floor((e.clientY - r.top - oy) / S);
    walkTo(x, y);
  });

  function setPaused(p) {
    if (!run || run.state.solved || busy()) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    dwell.reset();
    sfx('pause');
    if (p) {
      $('#pause-text').textContent = 'Banen venter på dig. Intet sker, før du vælger. ' + roundText() + '.';
      $('#btn-pause-end-round').disabled = !progress.roundActive();
      fitScreen(); $('#btn-resume').focus({ preventScroll: true });
    }
    drawBoard();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-levels').addEventListener('click', function () { sfx('click'); paused = false; $('#pause-overlay').hidden = true; openLevels('game'); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () {
    sfx('click');
    // Spørg først: ét blik eller klik må aldrig smide et spil i gang væk (arkade/bekraeft.js)
    ArkadeBekraeft.spoerg({ tekst: 'Runden stopper, og pointene gemmes ikke. Vil du gemme dem, så vælg Afslut runde i stedet.', onJa: function () { quitToMenu(); } });
  });
  $('#btn-pause-end-round').addEventListener('click', function () { sfx('click'); endRound(); });
  function quitToMenu() { cancelAnim(); run = null; paused = false; hideOverlays(); show('menu'); }

  // ---------- Runden er slut ----------
  // En runde er alle baner, man løser, indtil man vælger "Afslut runde". Hver bane tæller én gang
  // pr. runde (med det bedste resultat i runden). Summen kommer på top 10.
  var lastEntryId = null;
  function endRound() {
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    var r = progress.endRound(), rankText = '';
    lastEntryId = null;
    if (r.total > 0) {
      var res = records.add(CATEGORY, r.total, { levels: r.levels });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point i denne runde';
    cancelAnim(); run = null; paused = false; hideOverlays();
    $('#go-score').textContent = fmt(r.total);
    $('#go-levels').textContent = n1(r.levels, 'bane', 'baner') + ' løst i runden';
    $('#go-rank').textContent = rankText;
    renderRecordList($('#go-records'), lastEntryId);
    show('gameover');
    return r;
  }
  $('#btn-again').addEventListener('click', function () { sfx('click'); openLevels('menu'); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('click'); show('menu'); });

  function renderRecordList(ol, highlightId) {
    var list = records.list(CATEGORY);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li'), e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var n = typeof e.levels === 'number' ? e.levels : 0, sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(fmt(e.score) + ' point'));
        var lv = document.createElement('span'); lv.className = 'levels'; lv.textContent = ' · ' + n1(n, 'bane', 'baner');
        sc.appendChild(lv);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder ----------
  function openRecords() { renderRecordList($('#rec-list'), null); show('records'); }
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
      b.setAttribute('aria-pressed', String(typeof cur === 'boolean' ? String(cur) === val : cur === val));
    });
    $$('#settings [data-ksset]').forEach(function (b) { b.setAttribute('aria-pressed', String(String(ks.get(b.dataset.ksset)) === b.dataset.value)); });
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
  }
  $$('#settings [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); settingsTab = b.dataset.tab; syncSettingsUi(); fitScreen(); });
  });
  $$('#settings [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var val = b.dataset.value;
      arkade.set(b.dataset.set, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('click'); syncSettingsUi();
    });
  });
  $$('#settings [data-ksset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.ksset;
      ks.set(key, b.dataset.value === 'true'); sfx('click'); syncSettingsUi();
      if (key === 'glow') applyTheme();
      if (key === 'dwellRepeat') syncDwellRepeat();
    });
  });
  function stepDwell(delta) {
    var v = Math.round((arkade.get('dwellTime') + delta) * 100) / 100;
    arkade.set('dwellTime', Math.min(3, Math.max(0.5, v)));
    sfx('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('click');
    if (settingsReturn === 'game' && run) { show('game'); refresh(); showOverlay('#pause-overlay', '#btn-resume'); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (/^Arrow/.test(e.key)) e.preventDefault(); return; }
    if (!$('#solved-overlay').hidden) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (paused) return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undo(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (KEYS[e.key]) { e.preventDefault(); if (!e.repeat) move(KEYS[e.key]); }
  });

  // ---------- Tilpasning til skærmen ----------
  // Ingen skærm må kræve, at man ruller. Knapperne er ca. 3–4,2 cm, når der er plads;
  // ellers skrues knapstørrelse, afstande og skrift ned, til alt kan være der.
  var CM = 96 / 2.54;
  function baseSizes() {
    var vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
    return { btn: Math.max(3 * CM, Math.min(15 * vmin, 4.2 * CM)), gap: Math.max(0.8 * CM, 3 * vmin) };
  }
  function applyScale(scale, compact) {
    var b = baseSizes();
    root.style.setProperty('--btn', Math.max(84, Math.round(b.btn * scale)) + 'px');  // aldrig under 84 px (øjenstyring)
    root.style.setProperty('--gap', Math.max(6, Math.round(b.gap * scale)) + 'px');
    root.style.fontSize = (18 * Math.max(0.6, Math.min(1, 0.4 + 0.6 * scale))).toFixed(1) + 'px';
    root.classList.toggle('fit-compact', !!compact);
    root.classList.toggle('fit-tight', scale < 0.75);
  }
  function overflows(el) {
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return true;
    var r = el.getBoundingClientRect();
    return Array.prototype.some.call(el.children, function (c) {
      if (c.hidden || c.id === 'game-grid' || getComputedStyle(c).display === 'none') return false;
      var cr = c.getBoundingClientRect();
      return cr.top < r.top - 1 || cr.bottom > r.bottom + 1 || cr.left < r.left - 1 || cr.right > r.right + 1;
    });
  }
  function fitScreen() {
    var el = $('#' + current);
    if (!el) return;
    var targets = [el].concat($$('.overlay', el).filter(function (o) { return !o.hidden; }));
    var tries = [];
    var minScale = Math.min(1, 3 * CM / baseSizes().btn);
    [1, 0.97, 0.94, 0.9].forEach(function (s) { if (s >= minScale - 0.001) tries.push([s, false]); });
    if (tries.length === 0 || tries[tries.length - 1][0] > minScale) tries.push([minScale, false]);
    [1, 0.97, 0.94, 0.9].forEach(function (s) { if (s >= minScale - 0.001) tries.push([s, true]); });
    for (var s = Math.min(minScale, 1) - 0.04; s >= 0.299; s -= 0.04) tries.push([Math.round(s * 100) / 100, true]);
    for (var i = 0; i < tries.length; i++) {
      applyScale(tries[i][0], tries[i][1]);
      if (!targets.some(overflows)) return;
    }
  }

  // ---------- Layout af spilleskærmen ----------
  // Tre opstillinger; den, der giver de største felter, vælges:
  //   rundt  – pilene står rundt om brættet, menu/bane/fortryd/genstart i hjørnerne
  //   siden  – et pilekryds ved siden af brættet og menu/bane/fortryd/genstart i en kolonne
  //   under  – menu/bane/fortryd/genstart i en række øverst, brættet og et pilekryds under det
  function computeLayout(W, H, mw, mh, b, nr) {
    nr = nr || 0;   // plads til beskeden om fastlåst kasse under brættet
    var pad = Math.max(8, Math.min(W, H) * 0.015), g = Math.max(10, b * 0.18), out = [];
    var side = b * 1.2;
    var cA = Math.floor(Math.min((W - 2 * pad - 2 * side - 2 * g) / mw, (H - 2 * pad - 2 * b - 2 * g - nr) / mh));
    out.push({ name: 'rundt', cell: cA, score: cA * 1.15, b: b, g: g, side: side });
    // Menu/bane/fortryd/genstart er mindst 84 px; er der trangt, bliver afstanden
    // mellem dem mindre (dog mindst 10 px), før knapperne gør
    var hw = b * 1.25, hh = Math.max(84, b * 0.85), padW = 3 * b + 2 * g;
    var cg = Math.max(10, Math.min(g, (H - 2 * pad - 4 * hh) / 3)), colH = 4 * hh + 3 * cg;
    if (colH <= H - 2 * pad && padW <= H - 2 * pad) {
      var cB = Math.floor(Math.min((W - 2 * pad - hw - padW - 2 * g) / mw, (H - 2 * pad - nr) / mh));
      out.push({ name: 'siden', cell: cB, score: cB, b: b, g: g, hw: hw, hh: hh, padW: padW, cg: cg });
    }
    var rg = Math.max(10, Math.min(g, (W - 2 * pad - 4 * 84) / 3));
    var boxW = Math.min(b * 1.3, (W - 2 * pad - 3 * rg) / 4);
    if (boxW >= Math.max(84, b * 0.85) && padW <= W - 2 * pad) {
      var cC = Math.floor(Math.min((W - 2 * pad) / mw, (H - 2 * pad - hh - padW - 2 * g - nr) / mh));
      out.push({ name: 'under', cell: cC, score: cC, b: b, g: g, boxW: boxW, hh: hh, padW: padW, rg: rg });
    }
    return out.filter(function (l) { return l.cell >= 24; }).sort(function (a, c) { return c.score - a.score; })[0] || null;
  }
  function place(el, x, y, w, h) {
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    el.style.width = Math.round(w) + 'px'; el.style.height = Math.round(h) + 'px';
    el.style.setProperty('--s', Math.round(Math.min(w, h)) + 'px');
  }
  var lastLayout = null;
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var m = run.state;
    var W = window.innerWidth, H = window.innerHeight;
    var b0 = baseSizes().btn, L = null, ns = noteStrip(), nr = ns.h + ns.gap;
    for (var b = b0; b >= 36 && !L; b *= 0.95) L = computeLayout(W, H, m.w, m.h, b, nr);
    if (!L) L = { name: 'rundt', cell: 20, b: 36, g: 8, side: 43 };
    // Store felter er godt, men ikke enorme: højst ca. 3,4 cm pr. felt på en stor skærm
    L.cell = Math.min(L.cell, Math.round(Math.max(b0 * 1.3, 3.4 * CM)));
    lastLayout = L;
    var cell = L.cell, bw = cell * m.w, bh = cell * m.h, g = L.g;
    b = L.b;
    var grid = $('#game-grid');
    grid.className = 'game-grid lay-' + L.name;
    grid.style.setProperty('--u', (b / 100).toFixed(3) + 'px');
    $('#game').dataset.layout = L.name; $('#game').dataset.btn = Math.round(b);
    var E = {
      pause: $('#btn-pause'), hud: $('#hud-box'), undo: $('#btn-undo'), restart: $('#btn-restart'),
      board: $('#board-wrap'), note: $('#stuck-note'), up: $('.arrow-up'), left: $('.arrow-left'), right: $('.arrow-right'), down: $('.arrow-down')
    };
    function crossPad(px, py) {
      place(E.up, px + b + g, py, b, b);
      place(E.left, px, py + b + g, b, b);
      place(E.right, px + 2 * (b + g), py + b + g, b, b);
      place(E.down, px + b + g, py + 2 * (b + g), b, b);
    }
    if (L.name === 'rundt') {
      var side = L.side, long = Math.max(b, Math.min(Math.min(bw, bh) * 0.75, b * 2.6));
      var tw = side + g + bw + g + side, th = b + g + bh + nr + g + b;
      var x0 = (W - tw) / 2, y0 = (H - th) / 2, bx = x0 + side + g, by = y0 + b + g, cx = bx + bw / 2, cy = by + bh / 2;
      var rx = bx + bw + g, low = by + bh + nr + g;
      place(E.board, bx, by, bw, bh);
      place(E.note, x0, by + bh + ns.gap, tw, ns.h);
      place(E.pause, x0 + side - b, y0, b, b);
      place(E.up, cx - long / 2, y0, long, b);
      place(E.hud, rx, y0, side, b);
      place(E.left, x0 + side - b, cy - long / 2, b, long);
      place(E.right, rx, cy - long / 2, b, long);
      place(E.undo, x0, low, side, b);
      place(E.down, cx - long / 2, low, long, b);
      place(E.restart, rx, low, side, b);
    } else if (L.name === 'siden') {
      var tw2 = L.hw + g + bw + g + L.padW, x1 = (W - tw2) / 2;
      var colH = 4 * L.hh + 3 * L.cg, cy0 = (H - colH) / 2;
      [E.pause, E.hud, E.undo, E.restart].forEach(function (el, k) { place(el, x1, cy0 + k * (L.hh + L.cg), L.hw, L.hh); });
      var by2 = (H - bh - nr) / 2;
      place(E.board, x1 + L.hw + g, by2, bw, bh);
      place(E.note, x1 + L.hw + g - g / 2, by2 + bh + ns.gap, bw + g, ns.h);
      crossPad(x1 + L.hw + g + bw + g, (H - L.padW) / 2);
    } else {
      var th3 = L.hh + g + bh + nr + g + L.padW, y3 = (H - th3) / 2;
      var rowW = 4 * L.boxW + 3 * L.rg, rx3 = (W - rowW) / 2;
      [E.pause, E.hud, E.undo, E.restart].forEach(function (el, k) { place(el, rx3 + k * (L.boxW + L.rg), y3, L.boxW, L.hh); });
      place(E.board, (W - bw) / 2, y3 + L.hh + g, bw, bh);
      place(E.note, 8, y3 + L.hh + g + bh + ns.gap, W - 16, ns.h);
      crossPad((W - L.padW) / 2, y3 + L.hh + g + bh + nr + g);
    }
    E.hud.classList.toggle('slim', L.name === 'under' && L.hh < 80);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.round(bw * dpr);
    boardCanvas.height = Math.round(bh * dpr);
    drawBoard();
    fitNote();
  }
  window.addEventListener('resize', function () { layoutGame(); fitScreen(); });

  // ---------- Start ----------
  applyTheme();
  syncDwellRepeat();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Kasser = {
    get run() { return run; }, get busy() { return busy(); }, get screen() { return current; }, get layout() { return lastLayout; },
    settings: arkade, gameSettings: ks, records: records, progress: progress, dwell: dwell, audio: audio,
    start: startLevel, show: show, move: move, walkTo: walkTo, undo: undo, restart: restart, endRound: endRound,
    openLevels: openLevels, fit: fitScreen, refresh: refresh, category: CATEGORY,
    hover: function (d) { hoverDir = d; drawBoard(); },
    syncDwellRepeat: syncDwellRepeat, tema: tema, tokens: function () { return T; }
  };
})();
