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
  var lab = ArkadeSettings.create('labyrinten', { difficulty: 'normal', size: 'mellem' });
  var records = ArkadeHighscores.create('labyrinten', { max: 10 });
  var LIVES = 3;   // altid tre liv

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.DIFFICULTIES[lab.get('difficulty')]) lab.set('difficulty', 'normal');
  if (!G.SIZES[lab.get('size')]) lab.set('size', 'mellem');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul. Labyrinten bruger disse navne:
  var SFX = { move: 'move', dot: 'eat', pellet: 'bonus', ghost: 'bonusSpawn', frightEnd: 'bonusGone', caught: 'crash', cleared: 'bonus', record: 'record', click: 'click', pause: 'pause' };
  function sfx(name) { audio.play(SFX[name] || name); }

  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
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
      ghost: { jager: cssVar('--lab-g-jager'), afskaerer: cssVar('--lab-g-afskaerer'), vandrer: cssVar('--lab-g-vandrer'), lurer: cssVar('--lab-g-lurer') },
      scared: cssVar('--lab-scared'), scaredText: cssVar('--lab-scared-text'),
      eyes: cssVar('--lab-eyes'), eyeWhite: cssVar('--lab-eye-white'), pupil: cssVar('--lab-pupil'),
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
      : 'Bevægelse i baggrunden og rolig glidning. Fra får brikkerne til at hoppe direkte';
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
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function diffLabel(d) { return G.DIFFICULTIES[d].label; }
  function sizeLabel(s) { return G.SIZES[s].label; }
  function category(d, s) { return d + '-' + s; }
  function levelsText(n) { return n === 1 ? '1 bane ryddet' : n + ' baner ryddet'; }
  function ghostsText(n) { return n === 1 ? '1 spøgelse' : n + ' spøgelser'; }
  var DIFF_NOTES = {
    rolig: 'Rolig: 2–3 spøgelser, der kun flytter sig ét felt for hvert andet felt, du glider. Lang tid som bange.',
    normal: 'Normal: 3–4 spøgelser, der flytter sig ét felt for hvert felt, du glider.',
    svaer: 'Svær: 4 spøgelser fra start. Jægeren og afskæreren finder den korteste vej, og de er bange i kortere tid.'
  };

  // ---------- Startmenu ----------
  function syncMenu() {
    var d = lab.get('difficulty'), s = lab.get('size');
    $$('#menu [data-difficulty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.difficulty === d)); });
    $$('#menu [data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === s)); });
    $('#diff-note').textContent = DIFF_NOTES[d];
  }
  $$('#menu [data-difficulty]').forEach(function (b) {
    b.addEventListener('click', function () { lab.set('difficulty', b.dataset.difficulty); syncMenu(); sfx('click'); });
  });
  $$('#menu [data-size]').forEach(function (b) {
    b.addEventListener('click', function () { lab.set('size', b.dataset.size); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(lab.get('difficulty'), lab.get('size')); });
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
  function onFs() { syncFullscreen(); layoutGame(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, boardCanvas = $('#board');
  var anim = null;            // igangværende glidning
  var displayItems = null;    // prikkerne, som de ses på skærmen (under en glidning)
  var hoverDir = null;        // pilen, blikket hviler på (forhåndsvisning)
  var DIR_NAMES = { up: 'op', down: 'ned', left: 'til venstre', right: 'til højre' };
  var STEP_MS = 150;          // rolig glidning: ca. 0,15 sek. pr. felt

  function startGame() {
    cancelAnim();
    run = G.createRun({ size: lab.get('size'), difficulty: lab.get('difficulty'), lives: LIVES });
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
    var s = run.state;
    return {
      maze: s.maze, items: s.items, fright: s.fright,
      player: { x: s.player.x, y: s.player.y, dir: s.player.dir },
      ghosts: s.ghosts.map(function (g) {
        return { id: g.id, type: g.type, x: g.x, y: g.y, dir: g.dir, mode: g.mode, scared: g.scared, wait: g.wait,
                 intent: s.status === 'play' ? run.ghostIntent(g) : null };
      })
    };
  }
  function drawBoard() {
    if (!run || anim) return;
    var v = viewFromState();
    if (hoverDir && canPlay() && run.canMove(hoverDir)) v.preview = run.preview(hoverDir);
    LabyrintenRender.draw(boardCanvas, v, colors);
  }
  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-score').textContent = s.score;
    $('#hud-best').textContent = 'Rekord ' + records.best(category(s.difficulty, s.size));
    $('#hud-level').textContent = s.level;
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < s.maxLives; i++) {
      h.insertAdjacentHTML('beforeend', '<svg class="heart' + (i < s.lives ? ' full' : '') + '" aria-hidden="true"><use href="#lb-heart"/></svg>');
    }
    h.setAttribute('aria-label', s.lives === 1 ? '1 liv tilbage' : s.lives + ' liv tilbage');
    var hf = $('#hud-fright');
    if (s.fright > 0) {
      hf.classList.add('active');
      $('#hud-fright-value').textContent = s.fright;
      $('#hud-fright-text').textContent = s.fright === 1 ? 'felt tilbage' : 'felter tilbage';
    } else {
      hf.classList.remove('active');
      $('#hud-fright-value').textContent = '–';
      $('#hud-fright-text').textContent = 'ingen lige nu';
    }
    $$('.arrow').forEach(function (b) {
      var ok = run.canMove(b.dataset.dir);
      b.disabled = !ok;
      b.setAttribute('aria-label', (ok ? 'Glid ' : 'Væg – kan ikke gå ') + DIR_NAMES[b.dataset.dir]);
    });
    if (hoverDir && !run.canMove(hoverDir)) hoverDir = null;
    drawBoard();
  }

  function move(dir) {
    if (!canPlay()) return;
    var before = viewFromState();
    before.items = run.state.items.slice();
    var res = run.move(dir);
    if (res.ignored) return;
    if (!res.events.some(function (e) { return e.type === 'dot' || e.type === 'pellet'; })) sfx('move');
    var announced = false;
    function playEvents(f) {
      f.events.forEach(function (e) {
        if (e.type === 'dot' && !announced) { sfx('dot'); announced = true; }
        else if (e.type !== 'dot' && SFX[e.type]) sfx(e.type);
      });
    }
    if (!animationOn()) {
      res.frames.forEach(playEvents);
      finishMove(res);
      return;
    }
    // Rolig glidning felt for felt. Input er låst imens.
    displayItems = before.items;
    anim = { frames: res.frames, from: before, i: 0, t0: performance.now(), res: res, raf: 0, play: playEvents };
    anim.raf = requestAnimationFrame(tickAnim);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function tickAnim(now) {
    if (!anim) return;
    var a = anim, f = a.frames[a.i], prev = a.i === 0 ? a.from : frameView(a.frames[a.i - 1]);
    var t = Math.min(1, (now - a.t0) / STEP_MS);
    var s = run.state;
    var v = {
      maze: s.maze, items: displayItems, fright: prev.fright, moving: true,
      player: { x: lerp(prev.player.x, f.player.x, t), y: lerp(prev.player.y, f.player.y, t), dir: f.player.dir },
      ghosts: f.ghosts.map(function (g, k) {
        var pg = prev.ghosts[k] || g;
        return { id: g.id, type: s.ghosts[k].type, x: lerp(pg.x, g.x, t), y: lerp(pg.y, g.y, t), dir: g.dir,
                 mode: t < 1 ? pg.mode : g.mode, scared: t < 1 ? pg.scared : g.scared, wait: g.wait };
      })
    };
    LabyrintenRender.draw(boardCanvas, v, colors);
    if (t >= 1) {
      // feltet er nået: spis prikken og spil lyden
      displayItems[f.player.y * s.maze.w + f.player.x] = 0;
      a.play(f);
      $('#hud-score').textContent = f.score;
      a.i++;
      a.t0 = now;
      if (a.i >= a.frames.length) { anim = null; displayItems = null; finishMove(a.res); return; }
    }
    a.raf = requestAnimationFrame(tickAnim);
  }
  function frameView(f) { return { player: f.player, ghosts: f.ghosts, fright: f.fright }; }
  function cancelAnim() {
    if (anim && anim.raf) cancelAnimationFrame(anim.raf);
    anim = null; displayItems = null;
  }

  function finishMove(res) {
    refresh();
    dwell.reset();
    var s = run.state;
    var status = $('#board-status');
    if (res.result === 'caught' || res.result === 'over') {
      $('#caught-title').textContent = res.result === 'over' ? 'Fanget – ingen liv tilbage' : 'Fanget!';
      $('#caught-text').textContent = res.result === 'over'
        ? 'Spøgelserne fangede dig på bane ' + s.level + '.'
        : 'Du har ' + (s.lives === 1 ? '1 liv' : s.lives + ' liv') + ' tilbage. Alle stiller sig på plads igen, og prikkerne bliver liggende.';
      $('#btn-continue .big').textContent = res.result === 'over' ? 'Se resultatet' : 'Fortsæt';
      $('#caught-overlay').hidden = false;
      $('#btn-continue').focus({ preventScroll: true });
      status.textContent = $('#caught-text').textContent;
    } else if (res.result === 'cleared') {
      sfx('cleared');
      var nextGhosts = G.DIFFICULTIES[s.difficulty].ghosts(s.level + 1);
      var nextMaze = G.loadMaze(s.size, s.level).name;
      $('#clear-score').textContent = s.score + ' point';
      $('#clear-next').textContent = 'Næste labyrint hedder ' + nextMaze + ' og har ' + ghostsText(nextGhosts) + '.';
      $('#btn-next-sub').textContent = 'Bane ' + (s.level + 1);
      $('#clear-overlay').hidden = false;
      $('#btn-next').focus({ preventScroll: true });
      status.textContent = 'Banen er ryddet.';
    } else {
      status.textContent = s.score + ' point. ' + (s.fright > 0 ? 'Spøgelserne er bange i ' + s.fright + ' felter endnu.' : '');
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
    // Forhåndsvisning: hvor ender jeg, og hvor står spøgelserne bagefter?
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
    if (p) $('#btn-resume').focus({ preventScroll: true });
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
    var s = run.state, cat = category(s.difficulty, s.size);
    var rankText = '';
    lastEntryId = null;
    if (s.score > 0) {
      var res = records.add(cat, s.score, { levels: s.cleared });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = 'Spøgelserne fangede dig på bane ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-levels').textContent = levelsText(s.cleared);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = diffLabel(s.difficulty) + ' · ' + sizeLabel(s.size).toLowerCase();
    $('#go-records-title').textContent = 'Rekorder – ' + diffLabel(s.difficulty) + ', ' + sizeLabel(s.size).toLowerCase();
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
  var recDiff = 'normal', recSize = 'mellem';
  function openRecords(d, s) { recDiff = d; recSize = s; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-difficulty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recDifficulty === recDiff)); });
    $$('#records [data-rec-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recSize === recSize)); });
    $('#rec-title').textContent = 'Rekorder – ' + diffLabel(recDiff) + ', ' + sizeLabel(recSize).toLowerCase();
    renderRecordList($('#rec-list'), category(recDiff, recSize), null);
  }
  $$('#records [data-rec-difficulty]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recDiff = b.dataset.recDifficulty; syncRecords(); });
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
    if (settingsReturn === 'game' && run) { show('game'); refresh(); $('#pause-overlay').hidden = false; $('#btn-resume').focus({ preventScroll: true }); }
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

  // ---------- Layout af spilleskærmen ----------
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var m = run.state.maze;
    var btn = $('#btn-pause').offsetWidth || 120;
    var W = window.innerWidth, H = window.innerHeight;
    var pad = Math.max(10, Math.min(W, H) * 0.016);
    var gap = Math.max(19, Math.min(W, H) * 0.025);   // mindst ca. 0,5 cm
    var side = Math.max(btn, 170);
    var cell = Math.floor(Math.min((W - 2 * pad - 2 * side - 2 * gap) / m.w, (H - 2 * pad - 2 * btn - 2 * gap) / m.h));
    cell = Math.max(14, cell);
    var bw = cell * m.w, bh = cell * m.h;
    var grid = $('#game-grid');
    grid.style.setProperty('--board-w', bw + 'px');
    grid.style.setProperty('--board-h', bh + 'px');
    grid.style.setProperty('--game-gap', gap + 'px');
    grid.style.setProperty('--arrow-long', Math.max(btn, Math.min(Math.min(bw, bh) * 0.75, btn * 2.4)) + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.round(bw * dpr);
    boardCanvas.height = Math.round(bh * dpr);
    drawBoard();
  }
  window.addEventListener('resize', layoutGame);

  // ---------- Start ----------
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Labyrinten = {
    get run() { return run; }, get busy() { return busy(); }, get screen() { return current; },
    settings: arkade, gameSettings: lab, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, move: move, gameOver: gameOver,
    hover: function (d) { hoverDir = d; drawBoard(); }
  };
})();
