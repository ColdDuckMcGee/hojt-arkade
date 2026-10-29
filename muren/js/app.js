/*
 * Muren – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * Hver tur: drej kanonen med de store knapper (10° eller 2° ad gangen) eller
 * klik på brættet for at sigte, og tryk på Skyd. Den prikkede linje viser
 * kuglens vej til den første flade og ét hop videre. Salven afvikles i et
 * fast tempo (eller med det samme med Spring frem, når animation er slået fra,
 * eller når computeren er sat til mindre bevægelse). Der er ingen tid, og
 * muren er uendelig – spillet slutter, når en sten når bundlinjen.
 *
 * Logikken ligger i js/logik.js (ingen farver), tegningen i js/tegn.js (læser kun
 * tilstanden), lydene i js/lyd.js og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.MurenLogik;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // fart: hvor hurtigt salven flyver ('rolig', 'normal', 'hurtig').
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  // Standardværdierne (fart: Normal) ligger i logik.js, så de kan testes.
  var gset = ArkadeSettings.create('muren', L.SETTINGS);
  var FART = L.FART;   // tidsskridt pr. sekund
  if (L.fartAf(gset.get('fart')) !== gset.get('fart')) gset.set('fart', L.SETTINGS.fart);
  var records = ArkadeHighscores.create('muren', { max: 10 });
  var REC = 'muren';

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell på Skyd eller Spring frem = én handling. Drejeknapperne gentages
  // (data-dwell-repeat). Spillet holder sin egen lås på de to knapper: samme
  // knap kan først dwelles igen, når blikket har forladt den.
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
  // Knapper og menuer bruger det fælles lydmodul (alle rolige):
  var SFX = { aim: 'move', blocked: 'click', record: 'record', click: 'click', pause: 'pause' };
  // Spillets egne lyde (js/lyd.js, Web Audio). Et tema kan give dem andre klange (MurenTema.lyde).
  var lyd = MurenLyd.create({ sfx: arkade.get('sound'), volume: volumeSetting(), lyde: MurenTema.lyde });
  var LYD = { skud: 'skud', traef: 'traef', knust: 'knust', ring: 'ring', raekke: 'raekke', slut: 'slut' };
  // Fælles lydstyrke, hvis arkaden får en (0–1 eller 0–100). Ellers fuld styrke (systemets lydstyrke gælder).
  function volumeSetting() {
    var v = arkade.all().volume;
    if (typeof v !== 'number' || isNaN(v)) return 1;
    return v > 1 ? v / 100 : v;
  }
  function sfx(name, n) { if (LYD[name]) lyd.play(LYD[name], n); else audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); lyd.unlock(); }
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
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse. Salven vises med det samme'
      : 'Bevægelse i baggrunden og kuglerne, der flyver. Fra viser straks, hvordan salven ender';
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);

  arkade.onChange(function (key, value) {
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') dwell.setEnabled(value);
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') { audio.setSfx(value); lyd.setSfx(value); }
    if (key === 'volume') lyd.setVolume(volumeSetting());
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-muren-gloed', gset.get('gloed') ? 'til' : 'fra'); restyle(); }
  gset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    syncSettingsUi();
    if (run) refresh();
  });
  function restyle() {
    MurenTegn.readStyle();
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
  function turnsText(n) { return n === 1 ? '1 tur' : n + ' ture'; }
  function ballsText(n) { return n === 1 ? '1 kugle' : n + ' kugler'; }
  function bricksText(n) { return n === 1 ? '1 sten' : n + ' sten'; }

  // ---------- Startmenu ----------
  // Et fast lille billede af muren med sigtelinjen (samme seed hver gang)
  var DEMO = (function () {
    var s = L.newState(7);
    for (var t = 0; t < 4; t++) { s.bricks.forEach(function (b) { b.r += 1; }); s.rings.forEach(function (o) { o.r += 1; }); s.turn += 1; L.spawnRow(s); }
    s.balls = 5; s.aim = -24;
    return s;
  })();
  function drawMenuDemo() {
    var c = $('#menu-demo');
    if (!c || current !== 'menu' || c.offsetParent === null) return;
    MurenTegn.mini(c, DEMO, { preview: L.preview(DEMO, DEMO.aim, 1) });
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
  var run = null, paused = false, finished = false;
  var courseEl = $('#course');
  var lastNote = '', noteCls = '', afterTimer = 0;
  var tegn = MurenTegn.create(courseEl);
  var raf = 0, lastT = 0, acc = 0;

  function startGame(seed) {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    stopLoop();
    run = L.createRun(seed !== undefined ? { seed: seed } : {});
    paused = false; finished = false;
    lastNote = ''; noteCls = '';
    clearTimeout(afterTimer);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function playing() { return run && !paused && !finished && run.live() && current === 'game' && !overlayOpen(); }
  function flying() { return !!(run && run.volleyActive()); }
  // Man kan sigte og skyde, når ingen salve er i luften
  function live() { return playing() && !flying(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  function turnAim(d) {
    if (!live()) return;
    var a = run.state.aim;
    if (run.turnAim(d) === a) {
      sfx('blocked');
      setNote(d < 0 ? 'Kanonen kan ikke dreje længere mod venstre.' : 'Kanonen kan ikke dreje længere mod højre.', '');
      refresh(); return;
    }
    sfx('aim'); setNote('', ''); refresh();
  }
  function aimAtScreen(cx, cy) {
    if (!live()) return;
    var r = courseEl.getBoundingClientRect();
    var p = tegn.toWorld(cx - r.left, cy - r.top);
    if (p.x < 0 || p.x > L.W || p.y < 0 || p.y > L.H) return;
    run.aimAt(p);
    sfx('aim'); setNote('', ''); refresh();
  }
  courseEl.addEventListener('click', function (e) { aimAtScreen(e.clientX, e.clientY); });
  $$('#controls [data-turn]').forEach(function (b) { b.addEventListener('click', function () { turnAim(+b.dataset.turn); }); });

  // Skyd: salven afvikles i et fast tempo af animationsløkken (fast tidsskridt i
  // logikken, så resultatet er det samme uanset skærmens billedfrekvens).
  function fire() {
    if (!live()) return;
    if (!run.fire()) return;
    sfx('skud');
    setNote('', '');
    if (!animationOn()) { skip(true); return; }
    refresh();
    startLoop();
  }
  // Spring frem: resten af salven afvikles med det samme
  function skip(quiet) {
    if (!playing() || !flying()) return;
    stopLoop();
    var sum = run.finish();
    if (quiet !== true) sfx('click');
    afterVolley(sum);
  }
  $('#btn-fire').classList.add('turn-btn');
  $('#btn-skip').classList.add('turn-btn');
  $('#btn-fire').addEventListener('click', function () { if (!swallowed(this)) fire(); });
  $('#btn-skip').addEventListener('click', function () { if (!swallowed(this)) skip(); });

  function startLoop() {
    if (raf) return;
    lastT = 0; acc = 0;
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function tick(t) {
    raf = 0;
    if (!run || finished || !flying()) return;
    if (paused || current !== 'game') return; // fortsættes af setPaused(false)
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    acc += dt * (FART[gset.get('fart')] || FART.normal);
    var n = Math.floor(acc);
    acc -= n;
    var sum = n > 0 ? run.step(n) : null;
    if (sum) {
      if (sum.hits) sfx('traef', sum.hits);
      if (sum.breaks) sfx('knust', sum.breaks);
      if (sum.rings) sfx('ring', sum.rings);
    }
    if (sum && sum.done) { afterVolley(sum); return; }
    renderCourse();
    syncVolleyHud();
    raf = requestAnimationFrame(tick);
  }

  // Salven er færdig: muren er rykket ned (logikken har gjort det)
  function afterVolley(sum) {
    if (!run || finished) return;
    var s = run.state, lv = s.lastVolley || { points: 0, broken: 0, gained: 0 };
    if (s.over) {
      sfx('slut');
      setNote('Muren nåede bundlinjen. Spillet er slut.', 'err');
      refresh();
      afterTimer = setTimeout(function () { finish('lost'); }, 1400);
      return;
    }
    sfx('raekke');
    var parts = ['+' + pointsText(lv.points)];
    if (lv.broken) parts.push(bricksText(lv.broken) + ' knust');
    if (lv.gained) parts.push('+' + ballsText(lv.gained));
    setNote(parts.join(' · ') + '. Muren rykkede ét trin ned.', lv.points ? 'ok' : '');
    refresh();
  }

  // ---------- Tegning ----------
  function renderCourse() {
    if (!run || current !== 'game') return;
    var s = run.state, view = {};
    if (!s.volley && !s.over && (live() || paused)) view.preview = run.preview(1);
    tegn.draw(s, view);
  }
  // Fare: en sten står lige over bundlinjen (rykker den ned, er spillet slut)
  function danger(s) { return s.bricks.some(function (b) { return b.r >= L.ROWS - 2; }); }
  function syncVolleyHud() {
    var s = run.state, v = s.volley;
    $('#hud-score').textContent = s.score;
    if (v) $('#hud-balls').textContent = (v.balls.length - v.landed) + '/' + v.balls.length;
  }
  function refresh() {
    if (!run) return;
    var s = run.state, v = s.volley;
    $('#hud-turn').textContent = s.turn;
    $('#hud-balls').textContent = v ? (v.balls.length - v.landed) + '/' + v.balls.length : s.balls;
    $('#hud-score').textContent = s.score;
    $('#points-note').textContent = 'Træf giver 1 point. En knust sten giver 10 point + det tal, den startede med.';
    var a = Math.round(s.aim);
    $('#dir-value').textContent = (a > 0 ? '+' : '') + a + '°';
    $('#dir-arrow').style.transform = 'rotate(' + a + 'deg)';
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (v) { txt = 'Kuglerne flyver. Spring frem viser resultatet straks.'; cls = ''; }
    else if (!txt) {
      if (s.over) txt = 'Muren nåede bundlinjen.';
      else if (danger(s)) { txt = 'Pas på: en sten står lige over bundlinjen!'; cls = 'err'; }
      else txt = 'Tur ' + s.turn + ' – ' + ballsText(s.balls) + '. Sigt, og tryk på Skyd.';
    } else if (danger(s) && !s.over) { txt += ' Pas på bundlinjen!'; cls = 'err'; }
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    var on = live(), fly = playing() && flying();
    $$('#controls [data-turn]').forEach(function (b) { b.disabled = !on; });
    $('#btn-fire').disabled = !on;
    $('#btn-skip').disabled = !fly;
    if (on) {
      $('#controls [data-turn="-10"]').disabled = $('#controls [data-turn="-2"]').disabled = s.aim <= -L.RULES.maxAngle;
      $('#controls [data-turn="10"]').disabled = $('#controls [data-turn="2"]').disabled = s.aim >= L.RULES.maxAngle;
    }
    courseEl.classList.toggle('locked', !on);
    courseEl.setAttribute('aria-label', 'Brættet, tur ' + s.turn + ', ' + ballsText(s.balls) + ', ' + bricksText(s.bricks.length) + ' i muren. Vinkel ' + a + ' grader.');
    renderCourse();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  function setPaused(p) {
    if (!run || finished || run.state.over) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) { stopLoop(); $('#btn-resume').focus({ preventScroll: true }); }
    else if (flying()) startLoop();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit('pause'); });

  // ---------- Bekræft Afslut ----------
  function askQuit() {
    if (!run || finished || run.state.over) return;
    stopLoop();
    paused = true;
    $('#pause-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' efter ' + turnsText(s.turn) + '. Pointene gemmes i rekorderne.';
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
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
    if (flying()) startLoop();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { run = null; paused = false; clearTimeout(afterTimer); stopLoop(); hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  // Én rekordliste: point, og hvor mange ture muren holdt.
  var lastEntryId = null;
  function saveRecord() {
    var out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(REC, out.score, { turns: out.turns, broken: out.broken });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimeout(afterTimer); stopLoop();
    // Afsluttes midt i en salve, gøres den færdig først (pointene tæller med)
    if (run.volleyActive()) run.finish();
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
    if (s.over) $('#go-reason').textContent = 'Muren nåede bundlinjen i tur ' + s.turn + '.';
    else $('#go-reason').textContent = 'Du afsluttede i tur ' + s.turn + '.';
    $('#go-score').textContent = s.score;
    $('#go-turns').textContent = turnsText(s.turn) + ' · ' + bricksText(s.broken) + ' knust';
    $('#go-rank').textContent = rankText;
    $('#go-records-title').textContent = 'Rekorder';
    renderRecordList($('#go-records'), lastEntryId);
    show('gameover');
    MurenTegn.mini($('#go-pic'), s, {});
  }
  // Lukkes siden midt i et spil, gemmes pointene alligevel
  window.addEventListener('pagehide', function () { if (run && !finished) saveRecord(); });
  $('#btn-again').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('click'); quitToMenu(); });

  function renderRecordList(ol, highlightId) {
    var list = records.list(REC);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(e.score + ' point'));
        var lv = document.createElement('span'); lv.className = 'plates';
        lv.textContent = ' · ' + turnsText(typeof e.turns === 'number' ? e.turns : 0);
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
  function openRecords() { $('#rec-title').textContent = 'Rekorder'; renderRecordList($('#rec-list'), null); show('records'); }
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
  // Pil venstre/højre drejer 2° (Skift: 10°), Enter, mellemrum eller S skyder,
  // F eller Tab springer frem under en salve, Esc eller P giver pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (k === 'ArrowLeft') turnAim(e.shiftKey ? -10 : -2);
    else if (k === 'ArrowRight') turnAim(e.shiftKey ? 10 : 2);
    else if (k === 'f' || k === 'Tab') { if (flying()) { if (!e.repeat) skip(); } else if (k === 'Tab') handled = false; }
    else if (k === 'Enter' || k === ' ' || k === 's') { if (!e.repeat) { if (flying()) skip(); else fire(); } }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });


  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver det største bræt. Brættet er 700 × 1000
  // (højkant) og drejes aldrig, så "op" altid er op.
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  // Største bræt i et område (aw × ah)
  function fitBoard(aw, ah) {
    if (aw <= 0 || ah <= 0) return { w: 0, h: 0, k: 0 };
    var k = Math.min(aw / L.W, ah / L.H);
    return { w: Math.floor(L.W * k), h: Math.floor(L.H * k), k: k };
  }
  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10;
    var hudH = Math.max(50, Math.min(84, b * 0.62)), hint = small ? 44 : 58, head = small ? 32 : 40;
    var res = { p: p, g: g, hudH: hudH, ig: ig, head: head, hint: hint };
    // wide: status | bræt | sigte og skud (2 kolonner)
    var sideW = Math.min(340, Math.max(230, b * 2.1));
    var ctrlW = 2 * b + ig;
    var leftH = 100 + 3 * hudH + 2 * ig + 70 + b + 3 * ig;
    var rightH = hint + head + 4 * b + 5 * ig;
    res.sideW = sideW; res.ctrlW = ctrlW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? fitBoard(W - 2 * p - sideW - ctrlW - 2 * g, H - 2 * p) : null;
    // side / below: status på én række (3 felter + pause), knapperne i 4 kolonner
    var panelW = 4 * b + 3 * ig;
    var hudCols = 3, hudRows = 1;
    var statusH = Math.max(b, hudH);
    var ctlH = head + 2 * b + 2 * ig;
    var colH = statusH + g + hint + ig + ctlH;
    // Er der ikke plads til beskedlinjen ved knapperne, lægges den øverst på brættet
    res.hintBoard = { side: false, below: false };
    if (colH > H - 2 * p) { res.hintBoard.side = true; }
    res.panelW = panelW; res.hudCols = hudCols; res.statusH = statusH; res.hudHc = hudRows === 2 ? Math.max(40, (statusH - ig) / 2) : statusH;
    var colSide = res.hintBoard.side ? statusH + g + ctlH : colH;
    res.side = colSide <= H - 2 * p ? fitBoard(W - 2 * p - g - panelW, H - 2 * p) : null;
    // Beskedlinjen må ikke dække stenene: ved siden af brættet, hvis der er bredde nok, ellers over det
    res.hintMode = null; res.hintW = 0; res.hintH = hint;
    if (res.side && res.hintBoard.side) {
      var spare = W - 2 * p - g - panelW - res.side.w - ig;
      if (spare >= 110) { res.hintMode = 'col'; res.hintW = Math.floor(Math.min(spare, 220)); }
      else { res.hintMode = 'top'; res.side = fitBoard(W - 2 * p - g - panelW, H - 2 * p - hint - ig); }
    }
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
    gridEl.classList.toggle('hint-col', hb && res.hintMode === 'col');
    gridEl.classList.toggle('hint-top', hb && res.hintMode !== 'col');
    st.setProperty('--hint-w', (res.hintW || 0) + 'px');
    st.setProperty('--hint-h', (res.hintH || 44) + 'px');
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
    // Sikkerhedsnet: brættet gøres lidt mindre, til alt kan ses
    for (var t = 0; t < 30 && (overflows(gameEl) || overflows(root)) && f.k > 0.1; t++) {
      var k = f.k * 0.96;
      f = { w: Math.floor(L.W * k), h: Math.floor(L.H * k), k: k };
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
    root.classList.toggle('muren-lille', small);
    root.classList.toggle('muren-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('muren-tvaers')) ? opts.navBottom : opts.navIn;
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
    var minB = SMALL_MIN; // knapperne er aldrig under 84 px – hellere flere sider
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('muren-tvaers')) {
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
  MurenTegn.installerIkoner();
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
  window.Muren = {
    askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get flying() { return flying(); }, get tegn() { return tegn; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    start: startGame, show: show, fire: fire, skip: skip, turn: turnAim, aimAt: aimAtScreen,
    finish: finish, refresh: refresh, setPaused: setPaused, layout: layoutGame
  };
})();
