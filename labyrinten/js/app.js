/*
 * Labyrinten – brugerflade: skærme, input, indstillinger, lyd, animation og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Slangen og Minestryger.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.LabyrintenGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var lab = ArkadeSettings.create('labyrinten', { difficulty: 'normal', showPlans: true });
  var records = ArkadeHighscores.create('labyrinten', { max: 10 });
  var LIVES = 3;   // altid tre liv

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.DIFFICULTIES[lab.get('difficulty')]) lab.set('difficulty', 'normal');
  if (typeof lab.get('showPlans') !== 'boolean') lab.set('showPlans', true);

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul. Labyrinten bruger disse navne:
  var SFX = { move: 'move', dot: 'eat', pellet: 'bonus', guard: 'bonusSpawn', frightEnd: 'bonusGone', caught: 'crash', cleared: 'bonus', record: 'record', click: 'click', pause: 'pause', bump: 'obstacle' };
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
    colors = {
      board: cssVar('--lab-board'), wall: cssVar('--lab-wall'), wallFill: cssVar('--lab-wall-fill'),
      dot: cssVar('--lab-dot'), pellet: cssVar('--lab-pellet'),
      player: cssVar('--lab-player'), playerRim: cssVar('--lab-player-rim'),
      guard: { jaeger: cssVar('--lab-g-jaeger'), afskaerer: cssVar('--lab-g-afskaerer'), patrulje: cssVar('--lab-g-patrulje'), lurer: cssVar('--lab-g-lurer') },
      visor: cssVar('--lab-visor'), visorDot: cssVar('--lab-visor-dot'),
      scared: cssVar('--lab-scared'), scaredRim: cssVar('--lab-scared-rim'), scaredText: cssVar('--lab-scared-text'),
      eyes: cssVar('--lab-eyes'), pupil: cssVar('--lab-pupil'),
      preview: cssVar('--lab-preview'), danger: cssVar('--lab-danger'),
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
    root.classList.toggle('lab-anim', animationOn());
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

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'game') layoutGame();
    if (id === 'menu') syncMenu();
    fitScreen();
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function diffLabel(d) { return G.DIFFICULTIES[d].label; }
  function category(d) { return d; }   // én top 10 pr. sværhedsgrad
  function levelsText(n) { return n === 1 ? '1 bane ryddet' : n + ' baner ryddet'; }
  function guardsText(n) { return n === 1 ? '1 vagt' : n + ' vagter'; }
  function movesText(n) { return n === 1 ? '1 træk' : n + ' træk'; }
  var DIFF_NOTES = {
    rolig: 'Rolig: 2–3 vagter, der kun flytter sig ét felt efter hvert andet træk. Sårbare i ' + G.DIFFICULTIES.rolig.fright(1) + ' træk.',
    normal: 'Normal: 3–4 vagter, der flytter sig ét felt efter hvert træk. Sårbare i ' + G.DIFFICULTIES.normal.fright(1) + ' træk.',
    svaer: 'Svær: 4 kloge vagter fra start, der finder den korteste vej. Sårbare i kun ' + G.DIFFICULTIES.svaer.fright(1) + ' træk.'
  };

  // ---------- Startmenu ----------
  function syncMenu() {
    var d = lab.get('difficulty');
    $$('#menu [data-difficulty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.difficulty === d)); });
    $('#diff-note').textContent = DIFF_NOTES[d];
  }
  $$('#menu [data-difficulty]').forEach(function (b) {
    b.addEventListener('click', function () { lab.set('difficulty', b.dataset.difficulty); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(lab.get('difficulty')); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  var leaving = false;
  function goToHall() {
    if (leaving) return;
    leaving = true;
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, lab].forEach(function (s) {
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

  // ---------- Spillet ----------
  var run = null, paused = false, boardCanvas = $('#board');
  var anim = null;            // igangværende bevægelse (ét felt) eller et lille ryk mod en væg
  var hoverDir = null;        // pilen, blikket hviler på (forhåndsvisning)
  var bumpMark = null, bumpTimer = 0;
  var DIR_NAMES = { up: 'op', down: 'ned', left: 'til venstre', right: 'til højre' };
  var STEP_MS = 180;          // kort, rolig glidning fra ét felt til det næste
  var BUMP_MS = 220;          // lille ryk mod en væg

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    cancelAnim();
    run = G.createRun({ difficulty: lab.get('difficulty') });
    paused = false;
    hideOverlays();
    show('game');
    refresh();
  }
  function hideOverlays() { ['#pause-overlay', '#caught-overlay', '#clear-overlay'].forEach(function (s) { $(s).hidden = true; }); }
  function busy() { return !!anim; }
  function canPlay() {
    return run && current === 'game' && !paused && !busy() && run.state.status === 'play';
  }

  function viewFromState() {
    var s = run.state, playing = s.status === 'play';
    return {
      maze: s.maze, items: s.items, fright: s.fright, showPlans: lab.get('showPlans') && playing,
      player: { x: s.player.x, y: s.player.y, dir: s.player.dir },
      guards: s.guards.map(function (g) {
        return { id: g.id, type: g.type, x: g.x, y: g.y, dir: g.dir, mode: g.mode, scared: g.scared, wait: g.wait,
                 plan: playing ? run.guardPlan(g) : null };
      }),
      bump: bumpMark
    };
  }
  function drawBoard() {
    if (!run || anim) return;
    var v = viewFromState();
    if (hoverDir && canPlay()) v.preview = run.preview(hoverDir);
    LabyrintenRender.draw(boardCanvas, v, colors);
  }
  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-score').textContent = s.score;
    $('#hud-best').textContent = 'Rekord ' + records.best(category(s.difficulty));
    $('#hud-level').textContent = s.level;
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < s.maxLives; i++) {
      h.insertAdjacentHTML('beforeend', '<svg class="heart' + (i < s.lives ? ' full' : '') + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#lb-heart"/></svg>');
    }
    h.setAttribute('aria-label', s.lives === 1 ? '1 liv tilbage' : s.lives + ' liv tilbage');
    var hf = $('#hud-fright');
    if (s.fright > 0) {
      hf.classList.add('active');
      $('#hud-fright-value').textContent = s.fright;
      $('#hud-fright-text').textContent = 'træk tilbage';
    } else {
      hf.classList.remove('active');
      $('#hud-fright-value').textContent = '–';
      $('#hud-fright-text').textContent = 'ingen lige nu';
    }
    // Pilene er aldrig slået fra. Går man mod en væg, sker der intet (og det koster ikke et træk).
    $$('.arrow').forEach(function (b) {
      var d = b.dataset.dir, name = DIR_NAMES[d];
      b.setAttribute('aria-label', run.canMove(d) ? 'Gå ' + name : 'Gå ' + name + ' (væg)');
    });
    drawBoard();
  }

  function playEvents(events) {
    var any = false;
    events.forEach(function (e) {
      if (SFX[e.type]) { sfx(e.type); any = true; }
    });
    if (!any) sfx('move');
  }
  function move(dir) {
    if (!canPlay()) return;
    var beforeItems = run.state.items.slice();
    var res = run.move(dir);
    if (res.ignored) return;
    if (res.bump) { bump(dir); return; }
    if (!animationOn()) {
      playEvents(res.events);
      finishMove(res);
      return;
    }
    // Kort, rolig glidning fra ét felt til det næste. Input er låst imens (under 0,2 sek.).
    anim = { kind: 'step', res: res, items: beforeItems, t0: performance.now(), raf: 0 };
    anim.raf = requestAnimationFrame(tickAnim);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function alongPath(path, t) {
    if (path.length === 1) return path[0];
    var segs = path.length - 1, pos = Math.min(segs, t * segs), k = Math.min(segs - 1, Math.floor(pos)), f = pos - k;
    return { x: lerp(path[k].x, path[k + 1].x, f), y: lerp(path[k].y, path[k + 1].y, f) };
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function tickAnim(now) {
    if (!anim) return;
    var a = anim, s = run.state;
    if (a.kind === 'bump') {
      var tb = Math.min(1, (now - a.t0) / BUMP_MS);
      var off = Math.sin(tb * Math.PI) * 0.16, d = G.DIRS[a.dir];
      var vb = viewFromState();
      vb.showPlans = false;
      vb.player = { x: s.player.x + d.x * off, y: s.player.y + d.y * off, dir: s.player.dir };
      LabyrintenRender.draw(boardCanvas, vb, colors);
      if (tb >= 1) { anim = null; drawBoard(); return; }
      a.raf = requestAnimationFrame(tickAnim);
      return;
    }
    var res = a.res, f = res.frames[0];
    var t = ease(Math.min(1, (now - a.t0) / STEP_MS));
    var v = {
      maze: s.maze, items: a.items, fright: f.fright, moving: true,
      player: { x: lerp(res.from.player.x, f.player.x, t), y: lerp(res.from.player.y, f.player.y, t), dir: f.player.dir },
      guards: f.guards.map(function (g, k) {
        var pos = alongPath(res.paths[k] || [g], t);
        return { id: g.id, type: s.guards[k].type, x: pos.x, y: pos.y, dir: g.dir,
                 mode: g.mode, scared: g.scared, wait: g.wait };
      })
    };
    LabyrintenRender.draw(boardCanvas, v, colors);
    if (t >= 1) {
      anim = null;
      playEvents(res.events);
      finishMove(res);
      return;
    }
    a.raf = requestAnimationFrame(tickAnim);
  }
  // Mod en væg: intet sker, men et lille ryk (eller med animation fra: en kort streg ved væggen).
  function bump(dir) {
    sfx('bump');
    var btn = $('.arrow[data-dir="' + dir + '"]');
    if (btn) { btn.classList.remove('bumped'); void btn.offsetWidth; btn.classList.add('bumped'); }
    $('#board-status').textContent = 'Der er en væg ' + DIR_NAMES[dir] + '. Det koster ikke et træk.';
    clearTimeout(bumpTimer);
    bumpMark = { dir: dir };
    bumpTimer = setTimeout(function () { bumpMark = null; drawBoard(); }, 600);
    if (animationOn()) {
      anim = { kind: 'bump', dir: dir, t0: performance.now(), raf: 0 };
      anim.raf = requestAnimationFrame(tickAnim);
    } else {
      drawBoard();
    }
  }
  function cancelAnim() {
    if (anim && anim.raf) cancelAnimationFrame(anim.raf);
    anim = null; bumpMark = null; clearTimeout(bumpTimer);
  }

  function showOverlay(id, focusId) {
    $(id).hidden = false;
    fitScreen();
    $(focusId).focus({ preventScroll: true });
  }
  function finishMove(res) {
    refresh();
    dwell.reset();
    var s = run.state;
    var status = $('#board-status');
    if (res.result === 'caught' || res.result === 'over') {
      $('#caught-title').textContent = res.result === 'over' ? 'Fanget – ingen liv tilbage' : 'Fanget!';
      $('#caught-text').textContent = res.result === 'over'
        ? 'Vagterne fangede dig på bane ' + s.level + '.'
        : 'Du har ' + (s.lives === 1 ? '1 liv' : s.lives + ' liv') + ' tilbage. Alle stiller sig på plads igen, og prikkerne bliver liggende.';
      $('#btn-continue .big').textContent = res.result === 'over' ? 'Se resultatet' : 'Fortsæt';
      showOverlay('#caught-overlay', '#btn-continue');
      status.textContent = $('#caught-text').textContent;
    } else if (res.result === 'cleared') {
      var bonus = res.events.filter(function (e) { return e.type === 'cleared'; })[0].bonus;
      var nextGuards = G.DIFFICULTIES[s.difficulty].guards(s.level + 1);
      var nextMaze = G.loadMaze(s.level).name;
      $('#clear-score').textContent = s.score + ' point';
      $('#clear-bonus').textContent = '+' + bonus + ' point for bane ' + s.level;
      $('#clear-next').textContent = 'Næste labyrint hedder ' + nextMaze + ' og har ' + guardsText(nextGuards) + '.';
      $('#btn-next-sub').textContent = 'Bane ' + (s.level + 1);
      showOverlay('#clear-overlay', '#btn-next');
      status.textContent = 'Banen er ryddet. ' + bonus + ' point for banen.';
    } else {
      status.textContent = s.score + ' point. ' + (s.fright > 0 ? 'Vagterne er sårbare i ' + movesText(s.fright) + ' endnu.' : '');
    }
  }

  $('#btn-continue').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    $('#caught-overlay').hidden = true;
    if (run.state.status === 'over') { gameOver(); return; }
    run.continueAfterCatch();
    refresh();
  });
  $('#btn-next').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    run.nextLevel();
    $('#clear-overlay').hidden = true;
    layoutGame();
    refresh();
  });

  $$('.arrow').forEach(function (b) {
    b.addEventListener('click', function () { move(b.dataset.dir); });
    // Forhåndsvisning: hvor ender jeg, og bliver jeg fanget?
    function on() { hoverDir = b.dataset.dir; drawBoard(); }
    function off() { if (hoverDir === b.dataset.dir) { hoverDir = null; drawBoard(); } }
    b.addEventListener('pointerenter', on);
    b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on);
    b.addEventListener('blur', off);
  });

  function setPaused(p) {
    if (!run || run.state.status !== 'play' || busy()) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    dwell.reset();
    sfx('pause');
    if (p) { fitScreen(); $('#btn-resume').focus({ preventScroll: true }); }
    drawBoard();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); quitToMenu(); });
  function quitToMenu() { cancelAnim(); run = null; paused = false; hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    var s = run.state, cat = category(s.difficulty);
    var rankText = '';
    lastEntryId = null;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (s.score > 0) {
      var res = records.add(cat, s.score, { levels: s.cleared });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = 'Vagterne fangede dig på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = levelsText(s.cleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = diffLabel(s.difficulty);
    $('#go-records-title').textContent = 'Rekorder – ' + diffLabel(s.difficulty);
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
        var n = typeof e.levels === 'number' ? e.levels : 0;
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(e.score + ' point'));
        var lv = document.createElement('span'); lv.className = 'levels'; lv.textContent = ' · ' + (n === 1 ? '1 bane' : n + ' baner');
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
  var recDiff = 'normal';
  function openRecords(d) { recDiff = d; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-difficulty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recDifficulty === recDiff)); });
    $('#rec-title').textContent = 'Rekorder – ' + diffLabel(recDiff);
    renderRecordList($('#rec-list'), category(recDiff), null);
  }
  $$('#records [data-rec-difficulty]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recDiff = b.dataset.recDifficulty; syncRecords(); });
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
    $$('#settings [data-labset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(lab.get(b.dataset.labset)) === b.dataset.value));
    });
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
      var key = b.dataset.set, val = b.dataset.value;
      arkade.set(key, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('click');
      syncSettingsUi();
    });
  });
  $$('#settings [data-labset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var val = b.dataset.value;
      lab.set(b.dataset.labset, (val === 'true' || val === 'false') ? val === 'true' : val);
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
    if (settingsReturn === 'game' && run) { show('game'); refresh(); showOverlay('#pause-overlay', '#btn-resume'); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (KEYS[e.key]) {
      e.preventDefault();
      if (!e.repeat) move(KEYS[e.key]);
    }
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
    root.style.setProperty('--btn', Math.max(40, Math.round(b.btn * scale)) + 'px');
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
    // Først: hold knapperne på mindst 3 cm og skjul hellere de forklarende tekster.
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
  // Tre opstillinger; den, der giver de største felter, vælges (knapperne holdes så store som muligt):
  //   rundt  – pilene står rundt om brættet (bred skærm med god højde)
  //   siden  – et pilekryds ved siden af brættet og point/bane/sårbare i en kolonne (på langs)
  //   under  – point m.m. i en række øverst, brættet og et pilekryds under det (på højkant)
  function computeLayout(W, H, mw, mh, b) {
    var pad = Math.max(8, Math.min(W, H) * 0.015), g = Math.max(10, b * 0.18), out = [];
    // rundt
    var side = b * 1.2;
    var cA = Math.floor(Math.min((W - 2 * pad - 2 * side - 2 * g) / mw, (H - 2 * pad - 2 * b - 2 * g) / mh));
    out.push({ name: 'rundt', cell: cA, score: cA * 1.15, b: b, g: g, side: side });
    // siden
    var hw = b * 1.25, hh = b * 0.85, padW = 3 * b + 2 * g;
    var colH = b + 3 * hh + 3 * g;
    if (colH <= H - 2 * pad && padW <= H - 2 * pad) {
      var cB = Math.floor(Math.min((W - 2 * pad - hw - padW - 2 * g) / mw, (H - 2 * pad) / mh));
      out.push({ name: 'siden', cell: cB, score: cB, b: b, g: g, hw: hw, hh: hh, padW: padW });
    }
    // under
    var boxW = Math.min(b * 1.3, (W - 2 * pad - 3 * g) / 4);
    if (boxW >= b * 0.85 && padW <= W - 2 * pad) {
      var cC = Math.floor(Math.min((W - 2 * pad) / mw, (H - 2 * pad - hh - padW - 2 * g) / mh));
      out.push({ name: 'under', cell: cC, score: cC, b: b, g: g, boxW: boxW, hh: hh, padW: padW });
    }
    return out.filter(function (l) { return l.cell >= 14; }).sort(function (a, c) { return c.score - a.score; })[0] || null;
  }
  function place(el, x, y, w, h) {
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    el.style.width = Math.round(w) + 'px'; el.style.height = Math.round(h) + 'px';
    el.style.setProperty('--s', Math.round(Math.min(w, h)) + 'px');
  }
  var lastLayout = null;
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var m = run.state.maze;
    var W = window.innerWidth, H = window.innerHeight;
    var b0 = baseSizes().btn, L = null;
    for (var b = b0; b >= 36 && !L; b *= 0.95) L = computeLayout(W, H, m.w, m.h, b);
    if (!L) L = { name: 'rundt', cell: 12, b: 36, g: 8, side: 43 };
    lastLayout = L;
    var cell = L.cell, bw = cell * m.w, bh = cell * m.h, b = L.b, g = L.g;
    var grid = $('#game-grid');
    grid.className = 'game-grid lay-' + L.name;
    grid.style.setProperty('--u', (b / 100).toFixed(3) + 'px');
    var E = {
      pause: $('#btn-pause'), score: $('#hud-score-box'), level: $('#hud-level-box'), fright: $('#hud-fright'),
      board: $('#board-wrap'), up: $('.arrow-up'), left: $('.arrow-left'), right: $('.arrow-right'), down: $('.arrow-down')
    };
    function crossPad(px, py) {
      place(E.up, px + b + g, py, b, b);
      place(E.left, px, py + b + g, b, b);
      place(E.right, px + 2 * (b + g), py + b + g, b, b);
      place(E.down, px + b + g, py + 2 * (b + g), b, b);
    }
    if (L.name === 'rundt') {
      var side = L.side, long = Math.max(b, Math.min(Math.min(bw, bh) * 0.75, b * 2.6));
      var tw = side + g + bw + g + side, th = b + g + bh + g + b;
      var x0 = (W - tw) / 2, y0 = (H - th) / 2, bx = x0 + side + g, by = y0 + b + g, cx = bx + bw / 2, cy = by + bh / 2;
      var rx = bx + bw + g, low = by + bh + g;
      place(E.board, bx, by, bw, bh);
      place(E.pause, x0 + side - b, y0, b, b);
      place(E.up, cx - long / 2, y0, long, b);
      place(E.score, rx, y0, side, b);
      place(E.left, x0 + side - b, cy - long / 2, b, long);
      place(E.right, rx, cy - long / 2, b, long);
      place(E.level, x0, low, side, b);
      place(E.down, cx - long / 2, low, long, b);
      place(E.fright, rx, low, side, b);
    } else if (L.name === 'siden') {
      var tw2 = L.hw + g + bw + g + L.padW, x1 = (W - tw2) / 2;
      var colH = b + 3 * L.hh + 3 * g, cy0 = (H - colH) / 2;
      place(E.pause, x1 + (L.hw - b) / 2, cy0, b, b);
      place(E.score, x1, cy0 + b + g, L.hw, L.hh);
      place(E.level, x1, cy0 + b + g + L.hh + g, L.hw, L.hh);
      place(E.fright, x1, cy0 + b + 2 * (g + L.hh) + g, L.hw, L.hh);
      place(E.board, x1 + L.hw + g, (H - bh) / 2, bw, bh);
      crossPad(x1 + L.hw + g + bw + g, (H - L.padW) / 2);
    } else {
      var th3 = L.hh + g + bh + g + L.padW, y3 = (H - th3) / 2;
      var rowW = 4 * L.boxW + 3 * g, rx3 = (W - rowW) / 2;
      [E.pause, E.score, E.level, E.fright].forEach(function (el, k) { place(el, rx3 + k * (L.boxW + g), y3, L.boxW, L.hh); });
      place(E.board, (W - bw) / 2, y3 + L.hh + g, bw, bh);
      crossPad((W - L.padW) / 2, y3 + L.hh + g + bh + g);
    }
    [E.score, E.level, E.fright].forEach(function (el) { el.classList.toggle('slim', L.name === 'under' && L.hh < 80); });
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.round(bw * dpr);
    boardCanvas.height = Math.round(bh * dpr);
    drawBoard();
  }
  window.addEventListener('resize', function () { layoutGame(); fitScreen(); });

  // ---------- Start ----------
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Labyrinten = {
    get run() { return run; }, get busy() { return busy(); }, get screen() { return current; }, get layout() { return lastLayout; },
    settings: arkade, gameSettings: lab, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, move: move, gameOver: gameOver, fit: fitScreen, refresh: refresh,
    hover: function (d) { hoverDir = d; drawBoard(); }
  };
})();
