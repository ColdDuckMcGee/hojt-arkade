/*
 * Løberen – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ og samme skabelon som Frøen.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.LoeberenGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var bset = ArkadeSettings.create('loeberen', { diff: 'normal', preview: 'resultat', speed: 'normal' });
  var records = ArkadeHighscores.create('loeberen', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  var PREVIEWS = ['fra', 'sted', 'resultat', 'fuld'];
  var SPEEDS = { langsom: 1150, normal: 780, hurtig: 480 };
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.DIFFS[bset.get('diff')]) bset.set('diff', 'normal');
  if (PREVIEWS.indexOf(bset.get('preview')) < 0) bset.set('preview', 'resultat');
  if (!SPEEDS[bset.get('speed')]) bset.set('speed', 'normal');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Hvert dwell er præcis ét valg. Samme knap kan først dwelles igen, når
  // blikket har forladt den (også hvis knappen var slået fra et øjeblik).
  var gazeLock = null, suppress = null;
  var dwell = ArkadeDwell.create({
    enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000,
    onActivate: function (el) {
      if (!el.classList.contains('act')) return;
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
  var SFX = {
    side: 'move', up: 'bonusSpawn', down: 'move', hop: 'move', dyk: 'move', bliv: 'click', coin: 'eat', hit: 'crash',
    lifeLost: 'bonusGone', record: 'record', click: 'click', pause: 'pause', over: 'obstacle'
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
    var v = function (n) { return cssVar('--lb-' + n); };
    colors = {
      ground: v('ground'), road: v('road'), laneHi: v('lane-hi'), grid: v('grid'), edge: v('edge'), laneLine: v('lane-line'),
      city: v('city'), cityWin: v('city-win'), tower: v('tower'), towerEdge1: v('tower-edge1'), towerEdge2: v('tower-edge2'),
      towerWin: v('tower-win'), gate: v('gate'), low: v('low'), lowFill: v('low-fill'), high: v('high'), highFill: v('high-fill'),
      block: v('block'), blockFill: v('block-fill'), blockSide: v('block-side'), blockTop: v('block-top'), rampFill: v('ramp-fill'),
      wall: v('wall'), wallFill: v('wall-fill'),
      coin: v('coin'), coinFill: v('coin-fill'), runner: v('runner'), runnerFill: v('runner-fill'),
      ok: v('ok'), warn: v('warn'), ghost: v('ghost'), ghostAlpha: parseFloat(v('ghost-alpha')) || 0.85, danger: v('danger'),
      sky0: cssVar('--p-sky0'), sky1: cssVar('--p-sky1'), sky2: cssVar('--p-sky2'), sun0: cssVar('--p-sun0'), sun1: cssVar('--p-sun1'),
      font: getComputedStyle(document.body).fontFamily || 'sans-serif',
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
      : 'Bevægelse i baggrunden og banen. Fra giver en rolig fade';
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
  bset.onChange(function () { syncSettingsUi(); refresh(); });

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

  function diffName(id) { return G.DIFFS[id].name; }
  function livesText(n) { return n === 1 ? '1 liv' : n + ' liv'; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // ---------- Startmenu ----------
  function syncMenu() {
    var d = bset.get('diff');
    $$('#menu [data-diff]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.diff === d)); });
    $('#start-sub').textContent = diffName(d) + ' · ' + G.START_LIVES + ' liv';
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
    audio.setMusic(false);
    [arkade, bset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) audio.setMusic(arkade.get('music'));
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
  function onFs() { syncFullscreen(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, busy = false, finished = false;
  var boardCanvas = $('#board');
  var anim = null, raf = 0, fadeT0 = 0, hitGlow = 0, previewAct = null;
  var ACT_NAMES = { venstre: 'Venstre', hoejre: 'Højre', hop: 'Hop', dyk: 'Dyk', bliv: 'Bliv i banen' };
  var OBST_NAMES = {
    fri: 'fri', lav: 'lav laserbarriere', hoej: 'høj lysbjælke', mur: 'firewall',
    rampe: 'datablok med rampe', blok: 'datablok uden rampe', 'blok-lav': 'datablok med laser ovenpå', 'blok-hoej': 'datablok med lysbjælke ovenpå'
  };
  var HIT_LABEL = { lav: 'Rammer laseren', hoej: 'Rammer lysbjælken', mur: 'Rammer firewallen', blok: 'Blokken er en mur' };
  var CAUSES = {
    lav: 'Du løb ind i den lave laserbarriere.', hoej: 'Du ramte den høje lysbjælke.', mur: 'Du løb ind i en firewall.',
    blok: 'Du løb ind i en datablok uden rampe. Den kan kun nås oppefra.'
  };
  var LANE_NAMES = ['venstre bane', 'midterbanen', 'højre bane'];

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    run = G.createRun(bset.get('diff'));
    paused = false; busy = false; finished = false; anim = null; hitGlow = 0; previewAct = null;
    hideOverlays();
    show('game');
    refresh();
  }
  function hideOverlays() { ['#pause-overlay', '#death-overlay'].forEach(function (o) { $(o).hidden = true; }); }
  function overlayOpen() { return !$('#pause-overlay').hidden || !$('#death-overlay').hidden; }
  function playable() { return run && !run.state.over && !paused && !busy && !overlayOpen() && current === 'game'; }

  // Skyggen for det valg, man kigger på
  function ghostFor(a) {
    var mode = bset.get('preview');
    if (!a || mode === 'fra' || !playable() || !run.possible(a)) return null;
    var g = { action: a, verdict: 'neutral', label: '' };
    var oc = run.outcome(a); g.h = oc.ok ? oc.h : run.state.h;
    if (mode === 'sted') return g;
    if (!run.safe(a)) { g.verdict = 'hit'; g.label = '✗ ' + HIT_LABEL[run.cause(a)]; return g; }
    var seg = run.next(), t = G.target(run.state.lane, a);
    if (mode === 'fuld' && run.deadEnd(a)) { g.verdict = 'dead'; g.label = '⚠ Blindgyde forude'; return g; }
    var o = oc, h0 = run.state.h;
    g.verdict = 'safe';
    g.label = '✓ Sikkert' + (o.h > h0 ? ' · op på blokken' : o.h < h0 ? ' · ned' : o.h ? ' · oppe' : '') + (seg.coins && seg.coins[t] ? ' + mønt' : '');
    return g;
  }
  function drawBoard() {
    if (!run || current !== 'game') return;
    var now = performance.now();
    var fade = fadeT0 ? Math.max(0, 1 - (now - fadeT0) / 320) : 0;
    LoeberenRender.draw(boardCanvas, run, colors, {
      anim: anim, preview: anim ? null : ghostFor(previewAct), fadeIn: fade, hitGlow: hitGlow, level: run.levelNum()
    });
    return fade > 0;
  }
  function loop() {
    if (raf) return;
    var step = function (now) {
      raf = 0;
      var more = false;
      if (anim) {
        anim.t = Math.min(1, (now - anim.t0) / anim.dur);
        if (anim.t >= 1) { var done = anim; anim = null; finishMove(done); }
        else more = true;
      }
      if (drawBoard()) more = true;
      if (more) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-meters').textContent = fmt(s.meters);
    $('#hud-score').textContent = fmt(s.score);
    $('#hud-coins').textContent = s.coins;
    var h = $('#hud-lives');
    h.innerHTML = '';
    for (var i = 0; i < s.lives; i++) h.insertAdjacentHTML('beforeend', '<svg class="heart" aria-hidden="true"><use href="#lb-heart"/></svg>');
    $('#hud-lives-num').textContent = s.lives;
    h.setAttribute('aria-label', s.lives === 1 ? '1 liv tilbage' : s.lives + ' liv tilbage');
    var open = !s.over && !paused && !overlayOpen();
    $$('.act').forEach(function (b) {
      var ok = open && run.possible(b.dataset.act);
      b.disabled = !ok;
      b.classList.toggle('previewing', b.dataset.act === previewAct);
      var label = ACT_NAMES[b.dataset.act];
      if (!ok && open) label += ' (ikke muligt her)';
      b.setAttribute('aria-label', label);
    });
    boardCanvas.setAttribute('aria-label', boardLabel());
    drawBoard();
  }
  function boardLabel() {
    var s = run.state, seg = run.next();
    var parts = seg.lanes.map(function (o, l) { return LANE_NAMES[l] + ': ' + OBST_NAMES[o] + (seg.coins && seg.coins[l] ? ' med mønt' : ''); });
    return 'Banen. ' + fmt(s.meters) + ' meter, niveau ' + run.levelNum() + '. Du er i ' + LANE_NAMES[s.lane] + (s.h ? ' oppe på en datablok' : ' nede på nettet') + '. Næste stop – ' + parts.join(', ') + '.';
  }
  function announce() {
    var t = boardLabel();
    if ($('#stop-live').textContent !== t) $('#stop-live').textContent = t;
  }

  // Ét valg = ét stop. Banen ruller frem, og spillet fryser foran næste forhindring.
  function act(a) {
    if (!playable() || !run.possible(a)) return;
    var old = run.state.segs.slice(), oldPrev = run.state.prev;
    var res = run.act(a);
    if (res.ignored) return;
    previewAct = null;
    if (res.safe) sfx(res.toH > res.fromH ? 'up' : res.toH < res.fromH ? 'down' : a === 'venstre' || a === 'hoejre' ? 'side' : a);
    var segs = res.safe ? old.concat([run.state.segs[run.state.segs.length - 1]]) : old;
    if (animationOn()) {
      busy = true;
      anim = { t: 0, t0: performance.now(), dur: SPEEDS[bset.get('speed')], res: res, segs: segs, prev: oldPrev, from: res.from, to: res.to };
      // lyd for mønt og sammenstød, når løberen når forhindringen
      setTimeout(function () {
        if (res.coin) sfx('coin');
        if (!res.safe) sfx('hit');
      }, anim.dur * LoeberenRender.HIT);
      refresh();
      loop();
    } else {
      if (res.coin) sfx('coin');
      if (!res.safe) sfx('hit');
      fadeT0 = performance.now();
      finishMove({ res: res });
      loop();
    }
  }
  function finishMove(done) {
    busy = false;
    var res = done.res;
    if (!res.safe) {
      hitGlow = 0.85;
      sfx('lifeLost');
      if (res.over) saveRecord();
      showDeath(res);
    }
    refresh();
    announce();
  }
  $$('.act').forEach(function (b) {
    b.addEventListener('click', function () { if (!swallowed(b)) act(b.dataset.act); });
    // Forhåndsvisning: den knap, man kigger på eller har markeret
    var on = function () { previewAct = b.dataset.act; refresh(); };
    var off = function () { if (previewAct === b.dataset.act) { previewAct = null; refresh(); } };
    b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') on(); });
    b.addEventListener('pointerleave', off);
    b.addEventListener('focus', function () { if (b.matches(':focus-visible')) on(); });
    b.addEventListener('blur', off);
  });

  function showDeath(res) {
    var s = run.state, last = s.over;
    $('#death-title').textContent = last ? 'Det sidste liv er brugt' : 'Du mistede et liv';
    $('#death-reason').textContent = CAUSES[res.cause] + (last ? '' : ' Du har ' + livesText(s.lives) + ' tilbage.');
    $('#btn-continue-label').textContent = last ? 'Se resultat' : 'Løb videre';
    $('#btn-continue-sub').textContent = last ? 'Spillet er slut' : 'Vejen forude er lavet om';
    $('#death-overlay').hidden = false;
    fitScreen($('#death-overlay'));
    dwell.reset();
    $('#btn-continue').focus({ preventScroll: true });
  }
  $('#btn-continue').addEventListener('click', function () {
    if (!run) return;
    sfx('click');
    $('#death-overlay').hidden = true;
    hitGlow = 0;
    if (run.state.over) { gameOver(); return; }
    fadeT0 = performance.now();
    refresh();
    loop();
  });

  function setPaused(p) {
    if (!run || run.state.over || busy || !$('#death-overlay').hidden) return;
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
  function quitToMenu() { run = null; paused = false; busy = false; anim = null; hideOverlays(); show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  // Rekorden gemmes, så snart det sidste liv er brugt (også hvis man går fra spillet)
  var savedRec = null, savedFor = null;
  function saveRecord() {
    if (!run || run.state.score <= 0) return null;
    if (savedFor === run) return savedRec;
    savedFor = run;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    savedRec = records.add(run.state.diff, run.state.score, { meters: run.state.meters, coins: run.state.coins });
    return savedRec;
  }
  function gameOver() {
    if (finished || !run) return;
    finished = true;
    sfx('over');
    var s = run.state, cat = s.diff, rankText = '';
    lastEntryId = null;
    if (s.score > 0) {
      var res = saveRecord();
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    $('#go-reason').textContent = (CAUSES[s.lastCause] || '').replace(/\.$/, '') + ' efter ' + fmt(s.meters) + ' meter.';
    $('#go-score').textContent = fmt(s.score);
    $('#go-stats').textContent = fmt(s.meters) + ' meter · ' + (s.coins === 1 ? '1 mønt' : s.coins + ' mønter') + ' · niveau ' + s.maxLevel + ' · ' + diffName(cat);
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = diffName(cat);
    $('#go-records-title').textContent = 'Rekorder – ' + diffName(cat).toLowerCase();
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
        sc.appendChild(document.createTextNode(fmt(e.score) + ' point'));
        var lv = document.createElement('span'); lv.className = 'plates';
        lv.textContent = ' · ' + fmt(typeof e.meters === 'number' ? e.meters : 0) + ' m';
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
    $$('#records [data-rec-diff]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recDiff === recDiff)); });
    $('#rec-title').textContent = 'Rekorder – ' + diffName(recDiff).toLowerCase();
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
      b.setAttribute('aria-pressed', String(bset.get(b.dataset.bset) === b.dataset.value));
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
    b.addEventListener('click', function () { bset.set(b.dataset.bset, b.dataset.value); sfx('click'); syncSettingsUi(); });
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
  var KEYS = { ArrowUp: 'hop', ArrowDown: 'dyk', ArrowLeft: 'venstre', ArrowRight: 'hoejre', ' ': 'bliv', Enter: 'bliv' };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (/^Arrow/.test(e.key)) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 && e.key !== ' ' ? e.key.toLowerCase() : e.key;
    var a = KEYS[k] || (k === 'b' ? 'bliv' : null);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return; // én tast = ét valg
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    act(a);
  });
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Er vinduet for lille, bliver knapperne så store som muligt (mindst SMALL_MIN).
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  var LAYOUTS = ['wide', 'side', 'below'];
  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }

  // Banens størrelse for hvert layout ved knapstørrelse b. meas = målt statuspanel.
  function candidates(b, W, H, meas) {
    meas = meas || {};
    var d = spacing(W, H), p = d.p, g = d.g, pg = Math.max(8, Math.round(g * 0.6));
    var pad = 3 * b + 2 * pg;
    var sideW = Math.min(360, Math.max(220, b * 1.9));
    var hudH = meas.hudH || Math.max(SMALL_MIN, 90), hudW = meas.hudW || 270;
    var aw = W - 2 * p, ah = H - 2 * p, res = { p: p, g: g, pg: pg, pad: pad, sideW: sideW };
    function box(w, h) { w = Math.floor(Math.min(w, h * 1.5)); h = Math.floor(Math.min(h, w * 1.35)); return (w >= 120 && h >= 120) ? { w: w, h: h } : null; }
    res.wide = pad <= ah ? box(aw - sideW - pad - 2 * g, ah) : null;
    res.side = (hudH + g + pad <= ah) ? box(aw - Math.max(pad, hudW) - g, ah) : null;
    res.below = pad <= aw ? box(aw, ah - hudH - pad - 2 * g) : null;
    return res;
  }
  function q(r) { return r ? Math.min(r.w, r.h) : 0; }
  function pick(res) {
    var best = 0;
    LAYOUTS.forEach(function (l) { best = Math.max(best, q(res[l])); });
    if (!best) return null;
    if (q(res.wide) >= best * 0.85) return 'wide';
    return q(res.side) >= q(res.below) ? 'side' : 'below';
  }
  function applyLayout(lay, b, box, res) {
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    gridEl.classList.toggle('kort', lay === 'wide' && viewport().H < 620);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(innerWidth, innerHeight) * Math.min(1, b / cssBtn(innerWidth, innerHeight))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--pad-gap', res.pg + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--pause-s', SMALL_MIN + 'px');
    st.setProperty('--board-w', box.w + 'px');
    st.setProperty('--board-h', box.h + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    boardCanvas.width = Math.max(1, Math.round((box.w - 6) * dpr));
    boardCanvas.height = Math.max(1, Math.round((box.h - 6) * dpr));
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), small = isSmall(v);
    var floor = small ? SMALL_MIN : 80, b = Math.max(floor, cssBtn(v.W, v.H));
    var lay = null, res = null, box = null;
    for (var k = 0; k < 24; k++) {
      res = candidates(b, v.W, v.H);
      lay = pick(res);
      if (lay) {
        applyLayout(lay, b, res[lay], res);
        var hp = $('.hud-panel');
        res = candidates(b, v.W, v.H, { hudH: hp.offsetHeight, hudW: hp.offsetWidth });
        var l2 = pick(res);
        if (l2 && l2 !== lay) { lay = l2; applyLayout(lay, b, res[lay], res); res = candidates(b, v.W, v.H, { hudH: hp.offsetHeight, hudW: hp.offsetWidth }); }
        box = res[lay];
        // Hellere lidt mindre knapper end en meget lille bane
        var goodEnough = q(box) >= 0.66 * Math.min(v.W, v.H);
        if (box) {
          applyLayout(lay, b, box, res);
          if (!overflows(gameEl) && !overflows(root) && (goodEnough || b <= floor)) break;
        }
      }
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    gameEl.dataset.layout = lay || '';
    gameEl.dataset.btn = Math.round(b);
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
    root.classList.toggle('lb-lille', small);
    root.classList.toggle('lb-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('lb-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('lb-tvaers')) {
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

  // ---------- Start ----------
  syncSmall();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Loeberen = {
    get run() { return run; }, get busy() { return busy; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, act: act, refresh: refresh, gameOver: gameOver,
    preview: function (a) { previewAct = a; refresh(); }
  };
})();
