/*
 * Flipper – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * Spillet kører i faste tidsskridt (js/game.js). Her styres kun, hvor hurtigt
 * skridtene afspilles (Rolig, Normal, Hurtig), og hvad der vises:
 *  - Før afskydning: vælg kraft 1–5 og tryk Skyd.
 *  - Kuglen ruller: ingen knapper, ingen tidspres.
 *  - Spillet fryser (bordet dæmpes roligt): Venstre, Højre, Begge eller Lad være.
 *    Sigtelinjerne viser kuglens bane for hvert valg (samme fysik som spillet).
 *  - Kuglen er tabt: Næste kugle (eller Se resultat).
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.FlipperGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var fset = ArkadeSettings.create('flipper', { speed: 'normal', aim: true });
  var records = ArkadeHighscores.create('flipper', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (!G.SPEEDS[fset.get('speed')]) fset.set('speed', 'normal');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = ét valg. Samme knap kan først dwelles igen, når blikket har
  // forladt den (knapperne genbruges ved hver frysning).
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
  // Lydene kommer fra det fælles lydmodul. Flipper bruger disse navne:
  var SFX = {
    flipper: 'move', bumper: 'eat', sling: 'click', target: 'bonusSpawn', targetLit: 'click', lights: 'bonus',
    loop: 'bonus', drain: 'crash', extra: 'record', freeze: 'pause', launch: 'move', record: 'record',
    click: 'click', pause: 'pause', over: 'bonusGone'
  };
  var lastSfx = {};
  function sfx(name) {
    var now = performance.now(), key = SFX[name] || name;
    if (lastSfx[key] && now - lastSfx[key] < 90) return; // ikke en byge af ens lyde
    lastSfx[key] = now;
    audio.play(key);
  }
  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  var renderer = FlipperRender.create($('#board'));
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
    renderer.readColors();
    draw();
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    $('#game').classList.toggle('calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse. Kuglens spor vises tydeligere'
      : 'Bevægelse i baggrunden og lys på bordet. Fra giver rolige lys og et tydeligere spor efter kuglen';
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
  fset.onChange(function (key) { if (key === 'aim') { syncSettingsUi(); syncPhase(true); } });

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
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function pointsText(n) { return fmt(n) + ' point'; }
  function ballsText(n) { return n === 1 ? '1 kugle' : n + ' kugler'; }
  function speedName(id) { return G.SPEEDS[id].name; }

  // ---------- Startmenu ----------
  function syncMenu() {
    var sp = fset.get('speed');
    $$('#menu [data-speed]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.speed === sp)); });
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-speed]').forEach(function (b) {
    b.addEventListener('click', function () { fset.set('speed', b.dataset.speed); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(fset.get('speed')); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, fset].forEach(function (s) {
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
  function onFs() { syncFullscreen(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, finished = false;
  var shownPhase = '', previews = null, launchPreview = null, focusOpt = null;
  var freezeK = 0, flash = {}, trail = [], acc = 0, lastT = 0, note = '', noteT = 0;

  function startGame() {
    run = G.createRun({ speedId: fset.get('speed') });
    paused = false; finished = false;
    shownPhase = ''; previews = null; launchPreview = null; focusOpt = null;
    freezeK = 0; flash = {}; trail = []; acc = 0; note = '';
    $('#pause-overlay').hidden = true;
    show('game');
    syncPhase(true);
    refreshHud();
  }
  function live() { return run && !paused && !finished && current === 'game'; }

  // Fasen bestemmer, hvilke knapper der vises. Panelet har fast størrelse.
  var TITLES = {
    launch: 'Vælg kraft, og skyd',
    rolling: 'Kuglen ruller',
    decision: 'Spillet venter – vælg',
    lost: 'Kuglen er tabt'
  };
  function syncPhase(force) {
    if (!run) return;
    var s = run.state, ph = s.phase;
    if (ph === shownPhase && !force) return;
    var changed = ph !== shownPhase;
    shownPhase = ph;
    $$('#game [data-ctl]').forEach(function (p) { p.hidden = p.dataset.ctl !== ph; });
    var title = TITLES[ph] || '';
    if (ph === 'decision' && s.reason === 'stille') title = 'Kuglen ligger stille – vælg';
    $('#ctl-title').textContent = title;
    previews = null; launchPreview = null;
    if (ph === 'launch') {
      syncPower();
      if (changed) dwell.reset();
    } else if (ph === 'decision') {
      previews = {};
      G.OPTIONS.forEach(function (o) { previews[o] = run.preview(o); });
      G.OPTIONS.forEach(function (o) {
        var p = previews[o], el = $('#game [data-choice="' + o + '"] [data-outcome]');
        var t, bad = false;
        if (p.drained) { t = 'Kuglen går tabt'; bad = true; }
        else if (p.fired) t = 'Slår kuglen op' + (p.points > 0 ? ' · +' + fmt(p.points) : '');
        else if (o === 'none') t = 'Kuglen ruller videre' + (p.points > 0 ? ' · +' + fmt(p.points) : '');
        else t = 'Når ikke kuglen';
        el.textContent = t;
        el.classList.toggle('bad', bad);
      });
      if (changed) { dwell.reset(); sfx('freeze'); }
    } else if (ph === 'lost') {
      var last = s.ballsLeft <= 0;
      $('#lost-text').textContent = last ? 'Det var den sidste kugle.' : 'Du har ' + ballsText(s.ballsLeft) + ' tilbage.';
      $('#btn-next-label').textContent = last ? 'Se resultat' : 'Næste kugle';
      $('#btn-next-sub').textContent = last ? pointsText(s.score) : 'Kugle ' + (s.ballNo + 1);
      if (changed) dwell.reset();
    }
    if (ph !== 'decision') focusOpt = null;
    if (ph === 'launch' && fset.get('aim')) launchPreview = run.previewLaunch(s.power);
    refreshHud();
    draw();
  }
  function syncPower() {
    var p = run.state.power;
    $$('#game [data-power]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.power === p)); });
  }
  function setPower(p) {
    if (!live() || run.state.phase !== 'launch') return;
    if (run.setPower(p)) { sfx('click'); syncPower(); syncPhase(true); }
  }
  function shoot() {
    if (!live() || run.state.phase !== 'launch') return;
    if (run.shoot()) { trail = []; handleEvents(); syncPhase(); }
  }
  function choose(o) {
    if (!live() || run.state.phase !== 'decision') return;
    if (run.choose(o)) { sfx('click'); handleEvents(); syncPhase(); }
  }
  function nextBall() {
    if (!live() || run.state.phase !== 'lost') return;
    sfx('click');
    run.nextBall();
    handleEvents();
    if (run.state.phase === 'over') { gameOver(); return; }
    trail = [];
    syncPhase();
  }

  $$('#game [data-power]').forEach(function (b) {
    b.addEventListener('click', function () { if (!swallowed(b)) setPower(+b.dataset.power); });
  });
  $('#btn-shoot').addEventListener('click', function () { if (!swallowed(this)) shoot(); });
  $$('#game [data-choice]').forEach(function (b) {
    b.addEventListener('click', function () { if (!swallowed(b)) choose(b.dataset.choice); });
    // Blik, mus eller fokus på en knap fremhæver dens sigtelinje
    var on = function () { focusOpt = b.dataset.choice; draw(); };
    var off = function () { if (focusOpt === b.dataset.choice) { focusOpt = null; draw(); } };
    b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on); b.addEventListener('blur', off);
  });
  $('#btn-next').addEventListener('click', function () { if (!swallowed(this)) nextBall(); });

  // ---------- Hændelser fra spillet: point, lys og lyd ----------
  var NOTES = {
    lights: function (e) { return 'Alle lys tændt! Bonus ×' + e.mult; },
    loop: function (e) { return 'Sløjfe! +' + fmt(e.points); },
    extra: function () { return 'Ekstra kugle!'; },
    return: function () { return 'Kuglen kom tilbage – skyd igen'; }
  };
  function handleEvents() {
    if (!run) return;
    run.drainEvents().forEach(function (e) {
      if (e.type === 'bumper') flash['bumper-' + e.index] = 1;
      if (e.type === 'sling') flash['sling-' + e.side] = 1;
      if (e.type === 'target' || e.type === 'targetLit') flash['target-' + e.index] = 1;
      if (e.type === 'loop') flash['loop-' + e.side] = 1;
      if (NOTES[e.type]) { note = NOTES[e.type](e); noteT = performance.now(); }
      if (SFX[e.type]) sfx(e.type);
    });
    refreshHud();
  }
  var hudCache = {};
  function setText(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } }
  function refreshHud() {
    if (!run) return;
    var s = run.state;
    setText('#hud-score', fmt(s.score));
    var total = s.ballNo + Math.max(0, s.ballsLeft - (s.phase === 'lost' || s.phase === 'over' ? 0 : 1));
    setText('#hud-ball', s.ballNo + '/' + total);
    setText('#hud-mult', '×' + s.mult);
    var best = records.best(s.speedId);
    setText('#hud-best', fmt(Math.max(best ? best.score : 0, s.score)));
    var lit = s.lights.filter(Boolean).length, key = s.lights.join();
    if (hudCache.lights !== key) {
      hudCache.lights = key;
      $$('#hud-lights i').forEach(function (i, k) { i.classList.toggle('on', s.lights[k]); });
      $('#hud-lights').setAttribute('aria-label', 'Lys tændt: ' + lit + ' af 5');
    }
    if (note && performance.now() - noteT > 4000) note = '';
    setText('#points-note', note);
  }

  // ---------- Løkken: faste tidsskridt, afspillet i den valgte fart ----------
  function frame(t) {
    requestAnimationFrame(frame);
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (!run || current !== 'game') return;
    if (live() && run.state.phase === 'rolling') {
      acc += dt * G.SPEEDS[run.state.speedId].factor;
      var n = 0;
      while (acc >= G.STEP && n < 48) {
        run.step(); acc -= G.STEP; n++;
        trail.push({ x: run.state.ball.x, y: run.state.ball.y });
        if (trail.length > (animationOn() ? 40 : 90)) trail.shift();
        handleEvents();
        if (run.state.phase !== 'rolling') { acc = 0; break; }
      }
      if (run.state.phase !== 'rolling') {
        if (run.state.phase === 'over') { gameOver(); return; }
        syncPhase();
      }
    }
    // Rolig overgang ind og ud af frysningen (ingen blink)
    var target = run.state.phase === 'decision' ? 1 : 0;
    var rate = dt / (target ? 0.4 : 0.3);
    freezeK = target ? Math.min(1, freezeK + rate) : Math.max(0, freezeK - rate);
    // Lys på bordet falmer roligt
    var fade = dt / (animationOn() ? 0.35 : 0.6);
    for (var k in flash) { flash[k] -= fade; if (flash[k] <= 0) delete flash[k]; }
    if (note && performance.now() - noteT > 4000) refreshHud();
    draw();
  }
  function draw() {
    if (!run || current !== 'game') return;
    var aim = fset.get('aim');
    var calm = !animationOn();
    var fl = flash;
    if (calm) { fl = {}; for (var k in flash) fl[k] = Math.min(0.5, flash[k]); }
    renderer.draw(run, {
      freezeK: calm ? (run.state.phase === 'decision' ? Math.max(freezeK, 0.6) : freezeK) : freezeK,
      previews: aim ? previews : null,
      focus: focusOpt,
      launchPreview: aim ? launchPreview : null,
      trail: trail, calm: calm, flash: fl
    });
  }
  requestAnimationFrame(frame);

  function overlayOpen() { return !$('#pause-overlay').hidden; }
  function setPaused(p) {
    if (!run || finished) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    sfx('pause');
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); quitToMenu(); });
  function quitToMenu() { run = null; paused = false; $('#pause-overlay').hidden = true; show('menu'); }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    if (finished || !run) return;
    finished = true;
    var s = run.state, cat = s.speedId, rankText = '';
    lastEntryId = null;
    sfx('over');
    if (s.score > 0) {
      var res = records.add(cat, s.score, { mult: s.stats.bestMult, lights: s.stats.allLights });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    $('#go-reason').textContent = 'Alle kugler er brugt.';
    $('#go-score').textContent = fmt(s.score);
    var parts = [];
    parts.push((s.stats.allLights === 1 ? 'Alle lys tændt 1 gang' : 'Alle lys tændt ' + s.stats.allLights + ' gange'));
    if (s.stats.loops) parts.push(s.stats.loops === 1 ? '1 sløjfe' : s.stats.loops + ' sløjfer');
    if (s.stats.bestMult > 1) parts.push('bonus op til ×' + s.stats.bestMult);
    $('#go-levels').textContent = parts.join(' · ');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = speedName(cat);
    $('#go-records-title').textContent = 'Rekorder – ' + speedName(cat);
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
        sc.appendChild(document.createTextNode(pointsText(e.score)));
        if (e.mult > 1) {
          var lv = document.createElement('span'); lv.className = 'plates';
          lv.textContent = ' · bonus ×' + e.mult;
          sc.appendChild(lv);
        }
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
      ol.appendChild(li);
    }
  }

  // ---------- Rekorder ----------
  var recSpeed = 'normal';
  function openRecords(sp) { recSpeed = sp; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-speed]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recSpeed === recSpeed)); });
    $('#rec-title').textContent = 'Rekorder – ' + speedName(recSpeed);
    renderRecordList($('#rec-list'), recSpeed, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-speed]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recSpeed = b.dataset.recSpeed; syncRecords(); });
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
    $$('#settings [data-fset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(fset.get(b.dataset.fset)) === b.dataset.value));
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
  $$('#settings [data-fset]').forEach(function (b) {
    b.addEventListener('click', function () { fset.set(b.dataset.fset, b.dataset.value === 'true'); sfx('click'); syncSettingsUi(); });
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
    if (settingsReturn === 'game' && run) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen() || !run) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var ph = run.state.phase, handled = true;
    if (e.repeat) { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].indexOf(k) >= 0) e.preventDefault(); return; }
    if (ph === 'decision') {
      if (k === 'ArrowLeft' || k === 'a') choose('left');
      else if (k === 'ArrowRight' || k === 'l') choose('right');
      else if (k === 'ArrowUp' || k === 'b') choose('both');
      else if (k === 'ArrowDown' || k === ' ' || k === 'Enter' || k === 'n') choose('none');
      else handled = false;
    } else if (ph === 'launch') {
      if (k >= '1' && k <= '5') setPower(+k);
      else if (k === 'ArrowLeft' || k === 'ArrowDown') setPower(run.state.power - 1);
      else if (k === 'ArrowRight' || k === 'ArrowUp') setPower(run.state.power + 1);
      else if (k === ' ' || k === 'Enter') shoot();
      else handled = false;
    } else if (ph === 'lost') {
      if (k === ' ' || k === 'Enter') nextBall(); else handled = false;
    } else handled = k === ' ' || k === 'Enter';
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapper er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver det største bord, med så store knapper som muligt.
  var ASPECT = G.W / G.H;      // bordet er 600 × 1000
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }

  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g;
    var ig = Math.max(8, Math.min(14, b * 0.09));
    var titleH = small ? 34 : 44;
    var ctlW = 3 * b + 2 * ig, ctlH = titleH + ig + 2 * b + ig;
    var pauseS = Math.max(SMALL_MIN, Math.min(b, 104));
    var res = { p: p, g: g, ig: ig, titleH: titleH, ctlW: ctlW, ctlH: ctlH, pauseS: pauseS };
    // wide: status | bord | valg
    var sideW = Math.min(320, Math.max(220, b * 2));
    var hudColH = 90 + 170 + 34 + 64 + b + 4 * 12;
    res.sideW = sideW;
    res.wide = (hudColH <= H - 2 * p && ctlH <= H - 2 * p) ? Math.min(H - 2 * p, (W - 2 * p - sideW - ctlW - 2 * g) / ASPECT) : 0;
    // side: bord | (status over valg)
    res.side = (pauseS + g + ctlH <= H - 2 * p) ? Math.min(H - 2 * p, (W - 2 * p - g - ctlW) / ASPECT) : 0;
    // below: status / bord / valg
    res.below = (ctlW <= W - 2 * p) ? Math.min(H - 2 * p - pauseS - ctlH - 2 * g, (W - 2 * p) / ASPECT) : 0;
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 160)) res[l] = 0; });
    return res;
  }
  function pick(res, W, H) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    // Højkant: knapperne under bordet
    if (H > W && res.below && res.below >= res[best] * 0.9) best = 'below';
    return best;
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, bh, res, v) {
    var bw = Math.floor(bh * ASPECT); bh = Math.floor(bw / ASPECT);
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--pause-s', Math.round(res.pauseS) + 'px');
    st.setProperty('--ig', Math.round(res.ig) + 'px');
    st.setProperty('--title-h', res.titleH + 'px');
    var ctlW = res.ctlW;
    if (lay === 'below') ctlW = Math.min(v.W - 2 * res.p, Math.max(ctlW, bw));
    st.setProperty('--ctl-w', Math.floor(ctlW) + 'px');
    st.setProperty('--ctl-h', Math.floor(res.ctlH) + 'px');
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    gameEl.dataset.layout = lay;
    renderer.resize(bw, bh);
  }
  function bestFor(b, v, small) {
    var res = candidates(b, v.W, v.H, small), lay = pick(res, v.W, v.H);
    return { res: res, lay: lay, bh: res[lay] };
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), small = isSmall(v);
    var floor = small ? SMALL_MIN : 84;
    // Find det største bord ved de mindste knapper, og vælg så de største knapper,
    // der stadig giver mindst 85 % af det bord.
    var top = Math.max(floor, cssBtn(v.W, v.H)), list = [];
    for (var b = top; ; b = Math.max(floor, b * 0.95)) {
      list.push({ b: b, r: bestFor(b, v, small) });
      if (b <= floor) break;
    }
    var maxBh = 0; list.forEach(function (c) { maxBh = Math.max(maxBh, c.r.bh || 0); });
    var choice = list[list.length - 1];
    for (var i = 0; i < list.length; i++) if (list[i].r.bh >= maxBh * 0.85) { choice = list[i]; break; }
    var r = choice.r, bh = Math.max(160, r.bh || 160);
    applyLayout(r.lay, choice.b, bh, r.res, v);
    // Passer det ikke helt (fx lange tekster), så et lidt mindre bord
    for (var t = 0; t < 16 && (overflows(gameEl) || overflows(root)) && bh > 160; t++) {
      bh = Math.max(160, bh * 0.96);
      applyLayout(r.lay, choice.b, bh, r.res, v);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    draw();
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('fl-lille', small);
    root.classList.toggle('fl-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('fl-tvaers')) ? opts.navBottom : opts.navIn;
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

  // De andre skærme (og pauseboksen) tilpasses vinduet, til alt kan ses:
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
      if (el.id === 'menu' && !root.classList.contains('fl-tvaers')) {
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
  window.Flipper = {
    get run() { return run; }, get phase() { return run ? run.state.phase : null; },
    get previews() { return previews; }, get paused() { return paused; },
    settings: arkade, gameSettings: fset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, choose: choose, shoot: shoot, setPower: setPower, nextBall: nextBall,
    gameOver: gameOver, layout: layoutGame, draw: draw,
    // Spol frem til næste frysning eller tabt kugle (uden at vente i realtid)
    fastForward: function (maxSteps) {
      if (!run) return null;
      for (var i = 0; i < (maxSteps || 20000) && run.state.phase === 'rolling'; i++) {
        run.step(); trail.push({ x: run.state.ball.x, y: run.state.ball.y }); if (trail.length > 40) trail.shift();
        handleEvents();
      }
      if (run.state.phase === 'over') gameOver(); else syncPhase();
      return run.state.phase;
    }
  };
})();
