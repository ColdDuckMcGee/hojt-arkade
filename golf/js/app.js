/*
 * Golf – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * Hvert slag: drej retningen og vælg kraften med de store knapper (eller klik
 * på banen for at sigte), og tryk på Slå. Den prikkede forhåndslinje viser
 * boldens vej til og med det første bandehop (eller hele vejen, hvis det er
 * valgt). Der er ingen tid. Huller uden ende – spillet slutter, når slagpuljen
 * er tom (eller når man selv vælger Afslut).
 *
 * Logikken ligger i js/logik.js (ingen farver), tegningen i js/tegn.js (læser kun
 * tilstanden), og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.GolfLogik;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // forhaand: 'kort' (til og med første bandehop) eller 'hel' (hele vejen – egen rekordliste)
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  var gset = ArkadeSettings.create('golf', { forhaand: 'kort', gloed: true });
  if (['kort', 'hel'].indexOf(gset.get('forhaand')) < 0) gset.set('forhaand', 'kort');
  var records = ArkadeHighscores.create('golf', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell på Slå = ét slag. Drejeknapperne gentages (data-dwell-repeat).
  // Spillet holder sin egen lås på Slå: samme knap kan først dwelles igen,
  // når blikket har forladt den.
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
  function guardUnderGaze(rootEl) {
    releaseGuard();
    if (lastPX < 0) return;
    var el = document.elementFromPoint(lastPX, lastPY);
    var b = el && el.closest('button, a[href]');
    if (b && rootEl.contains(b)) { gazeGuard = b; b.setAttribute('data-no-dwell', ''); }
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
  // Lydene kommer fra det fælles lydmodul (alle rolige). Golf bruger disse navne:
  var SFX = {
    aim: 'move', power: 'move', strike: 'bonusSpawn', holed: 'bonus', water: 'obstacle',
    stopped: 'click', lost: 'crash', record: 'record', click: 'click', pause: 'pause', blocked: 'click'
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
    restyle();
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    $('#game').classList.toggle('calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og bolden, der ruller. Fra viser straks, hvor bolden ender';
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
  function applyGlow() { root.setAttribute('data-golf-gloed', gset.get('gloed') ? 'til' : 'fra'); restyle(); }
  gset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    syncSettingsUi();
    if (run) refresh();
  });
  function restyle() {
    GolfTegn.readStyle();
    if (typeof tegn !== 'undefined' && tegn) tegn.restyle();
    drawMenuDemo();
  }

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
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function holesText(n) { return n === 1 ? '1 hul' : n + ' huller'; }
  function strokesText(n) { return n === 1 ? '1 slag' : n + ' slag'; }
  function scoreName(par, strokes) {
    if (strokes === 1) return 'Hole-in-one!';
    var d = strokes - par;
    return { '-3': 'Albatros!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Dobbelt bogey' }[String(d)] || (d < 0 ? (-d) + ' under par!' : d + ' over par');
  }
  function mode() { return gset.get('forhaand'); }
  function modeName(m) { return m === 'hel' ? 'hele vejen' : 'kort linje'; }

  // ---------- Startmenu ----------
  var DEMO = (function () {
    var h = { tee: { x: 130, y: 450 }, hul: { x: 860, y: 170 }, vaegge: L.borders().concat([
      { ax: 480, ay: 0, bx: 480, by: 330, t: 18 }, { ax: 700, ay: 600, bx: 700, by: 380, t: 18 }]),
      sand: [{ x: 560, y: 70, w: 120, h: 90 }], vand: [{ x: 250, y: 120, w: 140, h: 110 }], skraaning: [] };
    return h;
  })();
  function drawMenuDemo() {
    var c = $('#menu-demo');
    if (!c || current !== 'menu' || c.offsetParent === null) return;
    var pv = L.preview(DEMO, DEMO.tee, 335, 7, 'kort');
    GolfTegn.mini(c, DEMO, DEMO.tee, { preview: { pts: pv.path, full: pv.full } });
  }
  function syncMenu() { if (current === 'menu') { fitScreen($('#menu')); drawMenuDemo(); } }
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, gset].forEach(function (s) {
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
  var run = null, paused = false, finished = false, rolling = false;
  var courseEl = $('#course');
  var lastNote = '', noteCls = '', afterTimer = 0;
  var runMode = 'kort';           // forhåndslinjen, spillet blev startet med (rekordlisten)
  var tegn = GolfTegn.create(courseEl);
  var ROLL_SPEED = 1.6;           // bolden ruller 1,6 gange hurtigere end virkelig tid

  function startGame(seed) {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    tegn.stop();
    run = L.createRun(seed !== undefined ? { seed: seed } : {});
    runMode = mode();
    paused = false; finished = false; rolling = false;
    lastNote = ''; noteCls = '';
    clearTimeout(afterTimer);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !rolling && run.live() && current === 'game' && !overlayOpen(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  function turnAim(d) {
    if (!live()) return;
    run.turnAim(d);
    sfx('aim'); setNote('', ''); refresh();
  }
  function changePower(d) {
    if (!live()) return;
    var p = run.state.power;
    if (run.setPower(p + d) === p) { sfx('blocked'); setNote(d > 0 ? 'Kraften er allerede størst (10).' : 'Kraften er allerede mindst (1).', ''); refresh(); return; }
    sfx('power'); setNote('', ''); refresh();
  }
  function aimAtScreen(cx, cy) {
    if (!live()) return;
    var r = courseEl.getBoundingClientRect();
    var p = tegn.toWorld(cx - r.left, cy - r.top);
    if (Math.hypot(p.x - run.state.ball.x, p.y - run.state.ball.y) < 4) return;
    run.aimAt(p);
    sfx('aim'); setNote('', ''); refresh();
  }
  courseEl.addEventListener('click', function (e) { aimAtScreen(e.clientX, e.clientY); });
  $$('#controls [data-turn]').forEach(function (b) { b.addEventListener('click', function () { turnAim(+b.dataset.turn); }); });
  $$('#controls [data-power]').forEach(function (b) { b.addEventListener('click', function () { changePower(+b.dataset.power); }); });

  // Slå: logikken afgør med det samme, hvor bolden ender; tegnelaget viser rullet
  function strike() {
    if (!live()) return;
    var res = run.strike();
    if (!res.ok) return;
    sfx('strike');
    rolling = true;
    setNote('Bolden ruller …', '');
    refresh();
    var done = function () { rolling = false; afterShot(res); };
    if (animationOn()) tegn.animate(run.state, res.sim.path, { speed: ROLL_SPEED, onDone: done });
    else { afterTimer = setTimeout(done, 120); }
  }
  $('#btn-strike').classList.add('turn-btn');
  $('#btn-strike').addEventListener('click', function () { if (!swallowed(this)) strike(); });

  function afterShot(res) {
    if (!run || finished) return;
    var s = run.state;
    if (res.holed) {
      sfx('holed'); setNote('', ''); refresh(); showDone(); return;
    }
    if (res.water) {
      sfx('water');
      setNote('Plask! Bolden røg i vandet: +1 strafslag. Den ligger igen, hvor du slog fra.', 'vand');
    } else {
      sfx('stopped');
      setNote('', '');
    }
    if (res.over) {
      sfx('lost');
      setNote(res.water ? 'Bolden røg i vandet, og slagpuljen er tom.' : 'Slagpuljen er tom, og bolden er ikke i hul.', 'err');
      refresh();
      afterTimer = setTimeout(function () { finish('lost'); }, 1400);
      return;
    }
    // Sigt mod hullet som udgangspunkt for næste slag
    run.aimAt(s.hole.hul);
    refresh();
  }

  // ---------- Tegning ----------
  function renderCourse() {
    if (!run || current !== 'game') return;
    if (tegn.animating) return;
    var s = run.state, view = {};
    if (s.lastShot && s.lastShot.path) view.trail = s.lastShot.path;
    if (live() || (paused && run.live())) {
      var pv = run.preview(runMode);
      view.preview = { pts: pv.path, full: pv.full };
      if (pv.full && runMode === 'hel' && pv.sim.result !== 'hul') view.endMarker = pv.sim.result === 'vand' ? null : pv.sim.end;
    }
    tegn.draw(s, view);
  }
  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-hole').textContent = s.level;
    $('#hud-par').textContent = 'par ' + s.hole.par;
    $('#hud-strokes').textContent = s.strokes;
    $('#hud-strokes-sub').textContent = s.penalties ? 'heraf ' + s.penalties + ' straf' : 'på hullet';
    $('#hud-pool').textContent = s.pool;
    
    $('.hud-pool').classList.toggle('low', s.pool <= 1 && !s.holed);
    $('#hud-score').textContent = s.score;
    $('#points-note').textContent = 'Under par giver ekstra slag til næste hul';
    // Retning og kraft
    var sa = tegn.screenAngle(s.aim);
    $('#dir-value').textContent = sa + '°';
    $('#dir-arrow').style.transform = 'rotate(' + sa + 'deg)';
    $('#pow-value').textContent = s.power;
    var m = $('#pow-meter');
    if (m.children.length !== L.RULES.powers) {
      var h = '';
      for (var k = 1; k <= L.RULES.powers; k++) h += '<i style="--k:' + k + '"></i>';
      m.innerHTML = h;
    }
    $$('i', m).forEach(function (el, k) { el.classList.toggle('on', k < s.power); });
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (!txt) {
      if (s.strokes === 0) txt = 'Hul ' + s.level + ', par ' + s.hole.par + '. Vælg retning og kraft, og slå.';
      else txt = 'Slag ' + (s.strokes + 1) + ' – ' + (s.pool === 1 ? 'sidste slag i puljen!' : strokesText(s.pool) + ' tilbage i puljen.');
      if (s.strokes > 0 && s.pool === 1) cls = 'err';
    }
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    var on = live();
    $$('#controls button').forEach(function (b) { b.disabled = !on; });
    if (on) {
      $('#controls [data-power="-1"]').disabled = s.power <= 1;
      $('#controls [data-power="1"]').disabled = s.power >= L.RULES.powers;
    }
    courseEl.classList.toggle('locked', !on);
    courseEl.setAttribute('aria-label', 'Banen, hul ' + s.level + ', par ' + s.hole.par + '. Retning ' + sa + ' grader, kraft ' + s.power + ' af ' + L.RULES.powers + '.');
    renderCourse();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Hul klaret ----------
  function showDone() {
    if (!run || !run.state.holed || finished) return;
    var s = run.state, pt = s.lastPoints;
    $('#done-kicker').textContent = 'Hul ' + s.level + ' · par ' + s.hole.par + ' · ' + strokesText(s.strokes);
    $('#done-title').textContent = scoreName(s.hole.par, s.strokes);
    $('#done-points').textContent = '+' + pointsText(pt.total);
    var parts = [pt.hole + ' for hullet', pt.level + ' i hulbonus'];
    if (pt.holeInOne) parts.push(pt.holeInOne + ' for hole-in-one');
    var txt = parts.join(' · ') + '. I alt ' + pointsText(s.score) + '. ';
    txt += 'Du tager ' + strokesText(s.reserve) + ' med i puljen til næste hul' + (pt.bonusStroke ? ' (+1 for hole-in-one)' : '') + (pt.capped ? ' (højst ' + L.RULES.maxReserve + ')' : '') + '.';
    $('#done-parts').textContent = txt;
    $('#btn-next-sub').textContent = 'Hul ' + (s.level + 1);
    $('#done-overlay').hidden = false;
    fitScreen($('#done-overlay'));
    GolfTegn.mini($('#done-pic'), s.hole, null, { trail: s.lastShot && s.lastShot.path });
    dwell.reset();
    guardUnderGaze($('#done-overlay'));
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextHole() {
    if (!run || !run.state.holed || finished) return;
    run.nextHole();
    $('#done-overlay').hidden = true;
    setNote('', '');
    sfx('click');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-next').addEventListener('click', nextHole);
  $('#btn-done-quit').addEventListener('click', function () { sfx('click'); askQuit('done'); });

  function setPaused(p) {
    if (!run || finished || rolling || run.state.holed || run.state.over) return;
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
  var confirmFrom = null;
  function askQuit(from) {
    if (!run || finished || run.state.over) return;
    confirmFrom = from;
    $('#pause-overlay').hidden = true;
    $('#done-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' og ' + holesText(s.cleared) + ' klaret. Pointene gemmes i rekorderne.';
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
    if (confirmFrom === 'done' && run && run.state.holed) { showDone(); return; }
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { run = null; paused = false; clearTimeout(afterTimer); tegn.stop(); rolling = false; hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  // Rekordlister pr. forhåndslinje: point og antal klarede huller.
  var lastEntryId = null;
  function saveRecord() {
    var out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(runMode, out.score, { holes: out.cleared });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimeout(afterTimer); tegn.stop(); rolling = false;
    var s = run.state, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-title').textContent = 'Spillet er slut';
    if (why === 'lost') $('#go-reason').textContent = 'Slagpuljen blev tom på hul ' + s.level + ' (par ' + s.hole.par + ').';
    else $('#go-reason').textContent = s.holed ? 'Du afsluttede efter hul ' + s.level + '.' : 'Du afsluttede på hul ' + s.level + '.';
    $('#go-score').textContent = s.score;
    $('#go-holes').textContent = holesText(s.cleared) + ' klaret';
    $('#go-rank').textContent = rankText;
    $('#go-records-title').textContent = 'Rekorder · ' + modeName(runMode);
    renderRecordList($('#go-records'), runMode, lastEntryId);
    show('gameover');
    GolfTegn.mini($('#go-pic'), s.hole, s.holed ? null : s.ball, { trail: s.lastShot && s.lastShot.path });
  }
  // Lukkes siden midt i et spil, gemmes pointene alligevel
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
        lv.textContent = ' · ' + holesText(typeof e.holes === 'number' ? e.holes : 0);
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
  var recMode = 'kort';
  function openRecords() { recMode = mode(); syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recMode === recMode)); });
    $('#rec-title').textContent = 'Rekorder · ' + modeName(recMode);
    renderRecordList($('#rec-list'), recMode, null);
  }
  $$('#records [data-rec-mode]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recMode = b.dataset.recMode; syncRecords(); fitScreen($('#records')); });
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
    $$('#settings [data-gset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(gset.get(b.dataset.gset)) === b.dataset.value));
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
  $$('#settings [data-gset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.value;
      gset.set(b.dataset.gset, (v === 'true' || v === 'false') ? v === 'true' : v);
      sfx('click'); syncSettingsUi();
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
    if (settingsReturn === 'game' && run && !finished && !run.state.over) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Pil venstre/højre drejer 1° (Skift: 10°), pil op/ned ændrer kraften,
  // Enter, mellemrum eller S slår, Esc eller P giver pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (k === 'ArrowLeft') turnAim(e.shiftKey ? -10 : -1);
    else if (k === 'ArrowRight') turnAim(e.shiftKey ? 10 : 1);
    else if (k === 'ArrowUp') { if (!e.repeat || true) changePower(1); }
    else if (k === 'ArrowDown') changePower(-1);
    else if (k === 'Enter' || k === ' ' || k === 's') { if (!e.repeat) strike(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver den største bane. Banen er 1000 × 600 og
  // kan stå på højkant (600 × 1000), hvis det giver en større bane.
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  // Største bane i et område (aw × ah): på langs eller på højkant
  function fitBoard(aw, ah) {
    if (aw <= 0 || ah <= 0) return { w: 0, h: 0, k: 0 };
    var kl = Math.min(aw / L.W, ah / L.H), kp = Math.min(aw / L.H, ah / L.W);
    if (kp > kl * 1.04) return { w: Math.floor(L.H * kp), h: Math.floor(L.W * kp), k: kp };
    return { w: Math.floor(L.W * kl), h: Math.floor(L.H * kl), k: kl };
  }
  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10;
    var hudH = Math.max(50, Math.min(84, b * 0.62)), hint = small ? 44 : 58, head = small ? 32 : 40;
    var res = { p: p, g: g, hudH: hudH, ig: ig, head: head, hint: hint };
    // wide: status | bane | slaget (2 kolonner)
    var sideW = Math.min(340, Math.max(230, b * 2.1));
    var ctrlW = 2 * b + ig;
    var leftH = 100 + 4 * hudH + 3 * ig + 70 + b + 3 * ig;
    var rightH = hint + 2 * head + 4 * b + 6 * ig;
    res.sideW = sideW; res.ctrlW = ctrlW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? fitBoard(W - 2 * p - sideW - ctrlW - 2 * g, H - 2 * p) : null;
    // side / below: status på én række (4 felter + pause), slaget i 4 kolonner
    var panelW = 4 * b + 3 * ig;
    var hudCols = (panelW - b - ig) >= 4 * 70 + 3 * ig ? 4 : 2, hudRows = 4 / hudCols;
    var statusH = Math.max(b, hudRows * hudH + (hudRows - 1) * ig);
    if (hudRows === 2) hudH = Math.min(hudH, (b - ig) / 2) > 40 ? Math.max(hudH, (b - ig) / 2) : hudH;
    var ctlH = head + 2 * b + 2 * ig;
    var colH = statusH + g + hint + ig + ctlH;
    // Er der ikke plads til beskedlinjen ved knapperne, lægges den øverst på banen
    res.hintBoard = { side: false, below: false };
    if (colH > H - 2 * p) { res.hintBoard.side = true; }
    res.panelW = panelW; res.hudCols = hudCols; res.statusH = statusH; res.hudHc = hudRows === 2 ? Math.max(40, (statusH - ig) / 2) : statusH;
    var colSide = res.hintBoard.side ? statusH + g + ctlH : colH;
    res.side = colSide <= H - 2 * p ? fitBoard(W - 2 * p - g - panelW, H - 2 * p) : null;
    res.below = panelW <= W - 2 * p ? fitBoard(W - 2 * p, H - 2 * p - colH - g) : null;
    LAYOUTS.forEach(function (l) { if (!res[l] || res[l].k * L.H < 120) res[l] = null; });
    return res;
  }
  function area(f) { return f ? f.k : 0; }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || area(res[l]) > area(res[best]) * 1.04) best = l; });
    if (res.wide && area(res.wide) >= area(res[best]) * 0.92) best = 'wide';
    return res[best] ? best : null;
  }
  function bestFit(v) {
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 20; k++) {
      var res = candidates(b, v.W, v.H, small), lay = pick(res);
      all.push({ b: b, res: res, lay: lay, k: lay ? res[lay].k : 0 });
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    var max = 0;
    all.forEach(function (o) { if (o.k > max) max = o.k; });
    for (var i = 0; i < all.length; i++) if (all[i].lay && all[i].k >= max / 1.06) return all[i];
    return all[all.length - 1];
  }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, f, res, v) {
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    gridEl.classList.toggle('ctl4', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ig', res.ig + 'px');
    st.setProperty('--head-h', res.head + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--ctrl-w', Math.floor(res.ctrlW) + 'px');
    st.setProperty('--hud-h', Math.round(lay === 'wide' ? res.hudH : res.hudHc) + 'px');
    st.setProperty('--hud-cols', lay === 'wide' ? 1 : res.hudCols);
    st.setProperty('--board-w', f.w + 'px');
    st.setProperty('--board-h', f.h + 'px');
    st.setProperty('--panel-w', Math.floor(lay === 'below' ? Math.min(v.W - 2 * res.p, Math.max(res.panelW, f.w)) : res.panelW) + 'px');
    gameEl.dataset.layout = lay;
    var hb = !!(res.hintBoard && res.hintBoard[lay]), hintEl = $('#hint');
    gridEl.classList.toggle('hint-board', hb);
    if (hb && hintEl.parentNode !== $('#board-wrap')) $('#board-wrap').appendChild(hintEl);
    if (!hb && hintEl.parentNode !== $('#side-right')) $('#side-right').insertBefore(hintEl, $('#controls'));
    gameEl.dataset.board = f.w + 'x' + f.h;
    if (tegn) tegn.resize(f.w, f.h);
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), small = isSmall(v);
    var floor = small ? SMALL_MIN : 84;
    var best = bestFit(v), b = best.b, lay = best.lay, res = best.res;
    if (!lay) { res = candidates(floor, v.W, v.H, small); lay = pick(res) || 'below'; b = floor; if (!res[lay]) res[lay] = fitBoard(v.W / 2, v.H / 3); }
    var f = res[lay];
    applyLayout(lay, b, f, res, v);
    // Sikkerhedsnet: banen gøres lidt mindre, til alt kan ses
    for (var t = 0; t < 30 && (overflows(gameEl) || overflows(root)) && f.k > 0.1; t++) {
      var k = f.k * 0.96;
      f = f.h > f.w ? { w: Math.floor(L.H * k), h: Math.floor(L.W * k), k: k } : { w: Math.floor(L.W * k), h: Math.floor(L.H * k), k: k };
      applyLayout(lay, b, f, res, v);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    renderCourse();
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('golf-lille', small);
    root.classList.toggle('golf-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('golf-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('golf-tvaers')) {
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
    if (current === 'menu') drawMenuDemo();
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    syncSmall();
    fitCurrent();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitCurrent, 150); // fx når adresselinjen på mobil skjules
  });

  // ---------- Start ----------
  GolfTegn.installerIkoner();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');
  drawMenuDemo();

  // Til test og fejlfinding
  window.Golf = {
    askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get rolling() { return rolling; }, get tegn() { return tegn; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, logik: L,
    start: startGame, show: show, strike: strike, turn: turnAim, power: changePower, aimAt: aimAtScreen,
    next: nextHole, finish: finish, showDone: showDone, refresh: refresh,
    setPaused: setPaused, layout: layoutGame
  };
})();
