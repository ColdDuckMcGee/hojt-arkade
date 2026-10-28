/*
 * Billard – brugerflade: skærme, input, computerens tur, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * Hvert stød: drej retningen og vælg kraften med de store knapper (eller klik
 * på bordet for at sigte), og tryk på Stød. Forhåndslinjen viser, hvor
 * stødbolden rammer første gang, og omtrent hvor objektkuglen og stødbolden
 * løber hen. Der er ingen tid. Partierne fortsætter, til man taber et.
 *
 * Logikken ligger i js/logik.js og js/ai.js (ingen farver), tegningen i
 * js/tegn.js (læser kun tilstanden), og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.BillardLogik, AI = window.BillardAI;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // niveau: computerens niveau. fint: de små drejeknapper (grader).
  // hjaelp: Næste kugle sigter mod hul (true) eller mod kuglens midte (false).
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  var gset = ArkadeSettings.create('billard', { niveau: 'normal', fint: '1', hjaelp: true, gloed: true });
  if (!L.LEVELS[gset.get('niveau')]) gset.set('niveau', 'normal');
  if (['1', '0.5', '0.2'].indexOf(String(gset.get('fint'))) < 0) gset.set('fint', '1');
  var records = ArkadeHighscores.create('billard', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell på Stød = ét stød. Drejeknapperne gentages (data-dwell-repeat).
  // Spillet holder sin egen lås på Stød: samme knap kan først dwelles igen,
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
  // Lydene kommer fra det fælles lydmodul (alle rolige). Billard bruger disse navne:
  var SFX = {
    aim: 'move', power: 'move', shoot: 'bonusSpawn', pot: 'eat', foul: 'obstacle', frame: 'bonus',
    stopped: 'click', lost: 'crash', record: 'record', click: 'click', pause: 'pause', blocked: 'click', cpu: 'bonusGone'
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
      : 'Bevægelse i baggrunden og kuglerne, der ruller. Fra viser straks, hvor kuglerne ender';
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
  function applyGlow() { root.setAttribute('data-billard-gloed', gset.get('gloed') ? 'til' : 'fra'); restyle(); }
  gset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'fint') syncFine();
    syncSettingsUi();
    if (run) refresh();
  });
  function fine() { return parseFloat(gset.get('fint')) || 1; }
  function fmtDeg(v) { return String(v).replace('.', ',') + '°'; }
  function syncFine() { $$('.js-fine').forEach(function (el) { el.textContent = fmtDeg(fine()); }); }
  function restyle() {
    BillardTegn.readStyle();
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
  function framesText(n) { return n === 1 ? '1 parti' : n + ' partier'; }
  function ballsText(n) { return n === 1 ? '1 kugle' : n + ' kugler'; }
  function levelName(l) { return (L.LEVELS[l] || L.LEVELS.normal).name; }
  function groupName(g, plural) { return g === 'hel' ? (plural ? 'de hele (1–7)' : 'hele 1–7') : g === 'halv' ? (plural ? 'de halve (9–15)' : 'halve 9–15') : 'åbent bord'; }
  function list(ids) {
    var t = ids.slice().sort(function (a, b) { return a - b; }).map(String);
    if (t.length <= 1) return t.join('');
    return t.slice(0, -1).join(', ') + ' og ' + t[t.length - 1];
  }
  var FOUL = {
    ingen: 'Stødbolden ramte ingen kugle',
    forkert: 'Stødbolden ramte først en forkert kugle',
    ikke8: 'Stødbolden skulle ramme 8\'eren først',
    aaben8: '8\'eren må ikke rammes først, så længe bordet er åbent',
    stoed: 'Stødbolden gik i hul',
    bande: 'Ingen kugle ramte en bande efter sammenstødet'
  };
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function pocketName(id) { var p = L.POCKETS[id]; return p ? p.navn : ''; }

  // ---------- Startmenu ----------
  function level() { return gset.get('niveau'); }
  var DEMO = (function () {
    var balls = L.rack(L.rng(7));
    return { balls: balls, aim: 0, preview: L.preview(balls, 0) };
  })();
  function drawMenuDemo() {
    var c = $('#menu-demo');
    if (!c || current !== 'menu' || c.offsetParent === null) return;
    BillardTegn.mini(c, DEMO.balls, { preview: DEMO.preview, cue: { aim: 0, power: 6 } });
  }
  function syncMenu() {
    $$('#menu [data-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.level === level())); });
    $('#btn-start .small').textContent = levelName(level()) + ' · partier, til du taber';
    if (current === 'menu') { fitScreen($('#menu')); drawMenuDemo(); }
  }
  $$('#menu [data-level]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); gset.set('niveau', b.dataset.level); syncMenu(); });
  });
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
  var tableEl = $('#table');
  var lastNote = '', noteCls = '', afterTimer = 0, cpuTimer = 0, cpuPhase = null;
  var runLevel = 'normal';
  var tegn = BillardTegn.create(tableEl);
  var ROLL_SPEED = 1.5;           // kuglerne ruller 1,5 gange hurtigere end virkelig tid
  var CPU_THINK = 700, CPU_AIM = 1100, AFTER_PAUSE = 450;   // ms (kan sættes ned i test)

  function startGame(seed) {
    tegn.stop();
    clearTimers();
    runLevel = level();
    run = L.createSeries(runLevel, seed);
    paused = false; finished = false; rolling = false; cpuPhase = null; lostReason = '';
    lastNote = ''; noteCls = '';
    hideOverlays();
    show('game');
    beginTurn();
  }
  function clearTimers() { clearTimeout(afterTimer); clearTimeout(cpuTimer); afterTimer = 0; cpuTimer = 0; }
  var OVERLAYS = ['#pause-overlay', '#done-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function active() { return run && !paused && !finished && !rolling && run.live() && current === 'game' && !overlayOpen(); }
  // Spilleren må sigte og støde
  function live() { return active() && run.state.turn === 'human'; }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  function beginTurn() {
    if (!run || finished) return;
    if (run.state.turn === 'cpu' && run.live()) startCpu();
    refresh();
  }

  function turnAim(d) {
    if (!live()) return;
    run.turnAim(d);
    sfx('aim'); setNote('', ''); refresh();
  }
  function changePower(d) {
    if (!live()) return;
    var p = run.state.power;
    if (run.setPower(p + d) === p) { sfx('blocked'); setNote(d > 0 ? 'Kraften er allerede størst (10).' : 'Kraften er allerede mindst (1).', ''); refresh(); return; }
    sfx('power');
    // Banderegel: ved lav kraft mindes spilleren om den
    setNote(run.state.power <= 3 && !run.state.breakShot ? 'Banderegel: efter sammenstødet skal en kugle i hul eller ramme en bande.' : '', '');
    refresh();
  }
  function nextBall() {
    if (!live()) return;
    var r = run.nextTarget(gset.get('hjaelp') !== false);
    if (!r) return;
    sfx('aim');
    var t = r.id === 8 ? '8\'eren' : 'kugle ' + r.id;
    if (r.pocket !== null && gset.get('hjaelp') !== false) setNote(cap(t) + ' nær hullet ' + pocketName(r.pocket) + ' (' + (r.index + 1) + ' af ' + r.count + '). Finjustér selv.', '');
    else setNote('Sigter på ' + t + ' (' + (r.index + 1) + ' af ' + r.count + ')' + (r.pocket === null && gset.get('hjaelp') !== false ? ': ingen fri vej til et hul.' : '.'), '');
    refresh();
  }
  function moveCue() {
    if (!live() || !run.state.ballInHand) return;
    var r = run.moveCue();
    if (!r) return;
    sfx('aim');
    setNote('Stødbolden er flyttet (sted ' + (r.index + 1) + ' af ' + r.count + ').', '');
    refresh();
  }
  function aimAtScreen(cx, cy) {
    if (!live()) return;
    var r = tableEl.getBoundingClientRect();
    var p = tegn.toWorld(cx - r.left, cy - r.top);
    var c = L.ballById(run.state.balls, 0);
    if (Math.hypot(p.x - c.x, p.y - c.y) < 4) return;
    run.aimAt(p);
    sfx('aim'); setNote('', ''); refresh();
  }
  tableEl.addEventListener('click', function (e) { aimAtScreen(e.clientX, e.clientY); });
  $$('#controls [data-turn]').forEach(function (b) {
    b.addEventListener('click', function () { var d = +b.dataset.turn; turnAim(b.hasAttribute('data-fine') ? d * fine() : d); });
  });
  $$('#controls [data-power]').forEach(function (b) { b.addEventListener('click', function () { changePower(+b.dataset.power); }); });
  $('#btn-next-ball').addEventListener('click', nextBall);
  $('#btn-move-cue').addEventListener('click', moveCue);

  // Stød: logikken afgør med det samme, hvor kuglerne ender; tegnelaget viser rullet
  function shoot() {
    if (!live()) return;
    doShot();
  }
  function doShot() {
    var res = run.shoot();
    if (!res.ok) return;
    sfx('shoot');
    rolling = true;
    setNote(res.who === 'human' ? 'Kuglerne ruller …' : 'Computeren støder …', '');
    refresh();
    var done = function () { rolling = false; afterShot(res); };
    if (animationOn()) tegn.animate(run.state, res.sim, res.before.map(function (b) { return b.id; }), { speed: ROLL_SPEED, onDone: done });
    else afterTimer = setTimeout(done, 120);
  }
  $('#btn-shoot').classList.add('turn-btn');
  $('#btn-shoot').addEventListener('click', function () { if (!swallowed(this)) shoot(); });

  // Beskeden efter et stød
  function describe(res) {
    var j = res.judge, s = run.state, you = res.who === 'human', parts = [];
    var who = you ? 'Du' : 'Computeren';
    if (res.breakShot && j.respotEight) parts.push('8\'eren gik i hul på åbningsstødet og er sat op igen.');
    if (j.foul) {
      parts.push('Fejlstød: ' + FOUL[j.reason] + (j.alsoCue ? ', og stødbolden gik i hul' : '') + '.');
      if (!res.winner) parts.push(you ? 'Computeren får kuglen i hånden.' : 'Du har kuglen i hånden. Den er lagt på et godt sted – tryk Flyt for at prøve et andet.');
      return { t: parts.join(' '), cls: you ? 'err' : 'ok' };
    }
    var pot = j.own.concat(j.opp);
    if (j.assign) parts.push(who + (you ? ' har ' : ' har ') + groupName(j.assign, true) + (you ? '.' : '. Du har ' + groupName(L.other(j.assign), true) + '.'));
    if (j.own.length) parts.push(who + ' nedlagde ' + list(j.own) + (you && res.points ? ' (+' + pointsText(res.points) + ')' : '') + '.');
    if (j.opp.length) parts.push((j.own.length ? 'Også ' : '') + list(j.opp) + ' gik i hul' + (you ? ' – ' + (j.opp.length === 1 ? 'den er' : 'de er') + ' computerens.' : ' – ' + (j.opp.length === 1 ? 'den er' : 'de er') + ' dine.'));
    if (!res.winner) {
      if (j.continues) parts.push(you ? 'Du støder igen.' : 'Computeren støder igen.');
      else if (!pot.length) parts.push((res.breakShot ? 'Ingen kugle i hul på åbningsstødet. ' : 'Ingen kugle i hul. ') + (you ? 'Computerens tur.' : 'Din tur.'));
      else parts.push(you ? 'Computerens tur.' : 'Din tur.');
      if (s.turn === 'human' && run.onEight('human')) parts.push('Nu skal du nedlægge 8\'eren.');
    }
    return { t: parts.join(' '), cls: j.own.length && you ? 'ok' : '' };
  }

  function afterShot(res) {
    if (!run || finished) return;
    var j = res.judge, s = run.state;
    if (res.winner) {
      if (res.winner === 'human') {
        sfx('frame'); setNote('', ''); refresh();
        afterTimer = setTimeout(showDone, AFTER_PAUSE);
        return;
      }
      sfx('lost');
      if (res.who === 'cpu') lostReason = 'Computeren nedlagde 8\'eren og vandt parti ' + s.frame + '.';
      else if (j.foul) lostReason = '8\'eren gik i hul med et fejlstød (' + FOUL[j.reason].toLowerCase() + '), så computeren vandt parti ' + s.frame + '.';
      else lostReason = '8\'eren gik i hul, før dine egne kugler var nedlagt, så computeren vandt parti ' + s.frame + '.';
      setNote(lostReason, 'err');
      refresh();
      afterTimer = setTimeout(function () { finish('lost'); }, 1600);
      return;
    }
    var d = describe(res);
    if (j.foul) sfx('foul'); else if (j.own.length || j.opp.length) sfx('pot'); else sfx('stopped');
    setNote(d.t, d.cls);
    beginTurn();
  }
  var lostReason = '';

  // ---------- Computerens tur ----------
  // Tænker (en kort pause), sigter (forhåndslinjen vises), og støder. Pause stopper det.
  function startCpu() {
    clearTimeout(cpuTimer);
    if (!run || finished || paused || run.state.turn !== 'cpu' || !run.live()) return;
    cpuPhase = 'think';
    cpuTimer = setTimeout(function () {
      if (!active() || run.state.turn !== 'cpu') return;
      var plan = AI.plan(run);
      run.prepareCpu(plan);
      cpuPhase = 'aim';
      sfx('cpu');
      if (!lastNote || /tænker/.test(lastNote)) setNote('Computeren sigter …', '');
      refresh();
      cpuTimer = setTimeout(function () {
        if (!active() || run.state.turn !== 'cpu') return;
        cpuPhase = null;
        doShot();
      }, CPU_AIM);
    }, CPU_THINK);
  }

  // ---------- Tegning ----------
  function renderTable() {
    if (!run || current !== 'game') return;
    if (tegn.animating) return;
    var s = run.state, view = {};
    var showAim = run.live() && !rolling && (s.turn === 'human' || cpuPhase === 'aim');
    if (showAim) {
      view.preview = run.preview();
      view.cue = { aim: s.aim, power: s.power };
      if (s.turn === 'human') view.targets = run.legalTargets('human');
      view.hand = s.ballInHand && s.turn === 'human';
    }
    tegn.draw(s, view);
  }
  function hudFor(who) {
    var s = run.state, g = s.groups[who];
    if (!g) return { v: '7', sub: 'åbent bord' };
    var n = run.remaining(who);
    return n === 0 ? { v: '8', sub: '8\'eren' } : { v: String(n), sub: groupName(g) };
  }
  function refresh() {
    if (!run) return;
    var s = run.state;
    $('#hud-frame').textContent = s.frame;
    $('#hud-level').textContent = levelName(s.level);
    var y = hudFor('human'), c = hudFor('cpu');
    $('#hud-you').textContent = y.v; $('#hud-you-sub').textContent = y.sub;
    $('#hud-cpu').textContent = c.v; $('#hud-cpu-sub').textContent = c.sub;
    $('#hud-you-box').classList.toggle('tur', run.live() && s.turn === 'human');
    $('#hud-cpu-box').classList.toggle('tur', run.live() && s.turn === 'cpu');
    $('#hud-score').textContent = s.score;
    $('#hud-won').textContent = framesText(s.framesWon) + ' vundet';
    $('#points-note').textContent = 'Egen kugle: ' + pointsText(L.RULES.points.ball * s.mult) + ' · vundet parti: ' + pointsText(L.RULES.points.frame * s.mult);
    // Retning og kraft
    var sa = tegn.screenAngle(s.aim);
    $('#dir-value').textContent = fmtDeg(Math.round(sa * 10) / 10);
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
    if (s.turn === 'cpu' && run.live() && !rolling && cpuPhase === 'think') { txt = (lastNote && !/sigter|tænker|støder/.test(lastNote) ? lastNote + ' ' : '') + 'Computeren tænker …'; }
    if (!txt) {
      if (s.turn === 'human') {
        if (s.breakShot) txt = 'Parti ' + s.frame + ': du slår op. Vælg retning og kraft, og tryk på Stød.';
        else if (s.ballInHand) txt = 'Du har kuglen i hånden. Tryk Flyt for et andet sted, eller stød.';
        else if (run.onEight('human')) txt = 'Nedlæg 8\'eren for at vinde partiet.';
        else txt = s.groups.human ? 'Din tur. Ram en af ' + groupName(s.groups.human, true) + ' først.' : 'Din tur. Bordet er åbent: ram en hel eller halv kugle.';
      } else txt = 'Computerens tur.';
    }
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    var on = live();
    $$('#controls button').forEach(function (b) { b.disabled = !on; });
    if (on) {
      $('#controls [data-power="-1"]').disabled = s.power <= 1;
      $('#controls [data-power="1"]').disabled = s.power >= L.RULES.powers;
      $('#btn-move-cue').disabled = !s.ballInHand || !s.handSpots || s.handSpots.length < 2;
    }
    $('#btn-pause').disabled = !run.live() || rolling;
    tableEl.classList.toggle('locked', !on);
    tableEl.setAttribute('aria-label', 'Bordet, parti ' + s.frame + '. ' + (s.turn === 'human' ? 'Din tur' : 'Computerens tur') + '. Retning ' + Math.round(sa) + ' grader, kraft ' + s.power + ' af ' + L.RULES.powers + '.');
    renderTable();
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Parti vundet ----------
  function showDone() {
    if (!run || run.state.frameOver !== 'human' || finished) return;
    var s = run.state;
    $('#done-kicker').textContent = 'Parti ' + s.frame + ' · ' + levelName(s.level);
    $('#done-title').textContent = 'Parti vundet!';
    $('#done-points').textContent = '+' + pointsText(s.framePoints);
    var how = s.last && s.last.who === 'cpu' ? 'Computeren nedlagde 8\'eren før tid, så partiet er dit. ' : 'Du nedlagde 8\'eren. ';
    $('#done-parts').textContent = how + 'I alt ' + pointsText(s.score) + ' og ' + framesText(s.framesWon) + ' vundet. Vind det næste, så fortsætter serien.';
    $('#btn-next-sub').textContent = 'Parti ' + (s.frame + 1) + (s.frame % 2 === 1 ? ' · computeren slår op' : ' · du slår op');
    $('#done-overlay').hidden = false;
    fitScreen($('#done-overlay'));
    BillardTegn.mini($('#done-pic'), s.balls, {});
    dwell.reset();
    guardUnderGaze($('#done-overlay'));
    $('#btn-next').focus({ preventScroll: true });
  }
  function nextFrame() {
    if (!run || run.state.frameOver !== 'human' || finished) return;
    run.nextFrame();
    $('#done-overlay').hidden = true;
    setNote('', '');
    sfx('click');
    dwell.reset();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    beginTurn();
  }
  $('#btn-next').addEventListener('click', nextFrame);
  $('#btn-done-quit').addEventListener('click', function () { sfx('click'); askQuit('done'); });

  function setPaused(p) {
    if (!run || finished || rolling || !run.live()) return;
    if (p === paused) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) { clearTimeout(cpuTimer); cpuPhase = null; fitScreen($('#pause-overlay')); }
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    if (!p) beginTurn(); else refresh();
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
    clearTimeout(cpuTimer); cpuPhase = null;
    $('#pause-overlay').hidden = true;
    $('#done-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' og ' + framesText(s.framesWon) + ' vundet. Pointene gemmes i rekorderne.';
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
    if (confirmFrom === 'done' && run && run.state.frameOver === 'human') { showDone(); return; }
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    beginTurn();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { run = null; paused = false; clearTimers(); tegn.stop(); rolling = false; cpuPhase = null; hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  // Rekordlister pr. niveau: point, vundne partier og nedlagte kugler.
  var lastEntryId = null;
  function saveRecord() {
    var out = run.end(), res = null;
    finished = true;
    if (out.score > 0) res = records.add(runLevel, out.score, { frames: out.framesWon, potted: out.potted });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimers(); tegn.stop(); rolling = false; cpuPhase = null;
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
    if (why === 'lost') $('#go-reason').textContent = lostReason || ('Computeren vandt parti ' + s.frame + '.');
    else $('#go-reason').textContent = s.frameOver === 'human' ? 'Du afsluttede efter parti ' + s.frame + '.' : 'Du afsluttede under parti ' + s.frame + '.';
    $('#go-score').textContent = s.score;
    $('#go-frames').textContent = framesText(s.framesWon) + ' vundet · ' + ballsText(s.potted) + ' nedlagt';
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = levelName(runLevel);
    $('#go-records-title').textContent = 'Rekorder · ' + levelName(runLevel);
    renderRecordList($('#go-records'), runLevel, lastEntryId);
    show('gameover');
    BillardTegn.mini($('#go-pic'), s.balls, {});
  }
  // Lukkes siden midt i et spil, gemmes pointene alligevel
  window.addEventListener('pagehide', function () { if (run && !finished) saveRecord(); });
  $('#btn-again').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('click'); quitToMenu(); });

  function renderRecordList(ol, cat, highlightId) {
    var lst = records.list(cat);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = lst[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(e.score + ' point'));
        var lv = document.createElement('span'); lv.className = 'plates';
        lv.textContent = ' · ' + framesText(typeof e.frames === 'number' ? e.frames : 0);
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
  var recLevel = 'normal';
  function openRecords() { recLevel = level(); syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-level]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recLevel === recLevel)); });
    $('#rec-title').textContent = 'Rekorder · ' + levelName(recLevel);
    renderRecordList($('#rec-list'), recLevel, null);
  }
  $$('#records [data-rec-level]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recLevel = b.dataset.recLevel; syncRecords(); fitScreen($('#records')); });
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
  // Pil venstre/højre drejer et fint trin (Skift: 10°), pil op/ned ændrer kraften,
  // N sigter på næste kugle, F flytter kuglen i hånden, Enter, mellemrum eller S
  // støder, Esc eller P giver pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (k === 'ArrowLeft') turnAim(e.shiftKey ? -10 : -fine());
    else if (k === 'ArrowRight') turnAim(e.shiftKey ? 10 : fine());
    else if (k === 'ArrowUp') changePower(1);
    else if (k === 'ArrowDown') changePower(-1);
    else if (k === 'n') nextBall();
    else if (k === 'f') moveCue();
    else if (k === 'Enter' || k === ' ' || k === 's') { if (!e.repeat) shoot(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver det største bord. Bordet med ramme er
  // 1120 × 620 og kan stå på højkant (620 × 1120), hvis det giver et større bord.
  var BW = BillardTegn.OW, BH = BillardTegn.OH;
  var LAYOUTS = ['wide', 'side', 'side5', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  function fitBoard(aw, ah) {
    if (aw <= 0 || ah <= 0) return { w: 0, h: 0, k: 0 };
    var kl = Math.min(aw / BW, ah / BH), kp = Math.min(aw / BH, ah / BW);
    // Bordet drejes kun på højkant, når det giver et tydeligt større bord
    if (kp > kl * 1.12) return { w: Math.floor(BH * kp), h: Math.floor(BW * kp), k: kp };
    return { w: Math.floor(BW * kl), h: Math.floor(BH * kl), k: kl };
  }
  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10;
    var hudH = Math.max(50, Math.min(84, b * 0.62)), hint = small ? 44 : 64, head = small ? 32 : 40;
    var res = { p: p, g: g, hudH: hudH, ig: ig, head: head, hint: hint };
    // wide: status | bord | stødet (2 kolonner: 7 rækker)
    var sideW = Math.min(340, Math.max(230, b * 2.1));
    var ctrlW = 2 * b + ig;
    var leftH = 100 + 4 * hudH + 3 * ig + 70 + b + 3 * ig;
    var rightH = hint + 2 * head + 5 * b + 8 * ig;
    // wide: beskedlinjen står i en smal kolonne, så den får 4 linjer, når der er plads
    if (rightH + 28 <= H - 2 * p) { res.hintWide = hint + 28; rightH += 28; } else res.hintWide = hint;
    res.sideW = sideW; res.ctrlW = ctrlW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? fitBoard(W - 2 * p - sideW - ctrlW - 2 * g, H - 2 * p) : null;
    // side / below: status på én række (4 felter + pause), stødet i 4 kolonner (3 rækker knapper)
    var panelW = 4 * b + 3 * ig;
    var hudCols = (panelW - b - ig) >= 4 * 74 + 3 * ig ? 4 : 2, hudRows = 4 / hudCols;
    var statusH = Math.max(b, hudRows * hudH + (hudRows - 1) * ig);
    var ctlH = head + 3 * b + 3 * ig;
    var colH = statusH + g + hint + ig + ctlH;
    // Er der ikke plads til beskedlinjen ved knapperne, lægges den øverst på bordet
    res.hintBoard = { side: colH > H - 2 * p, below: false };
    res.panelW = panelW; res.hudCols = hudCols; res.statusH = statusH; res.hudHc = hudRows === 2 ? Math.max(40, (statusH - ig) / 2) : statusH;
    var colSide = res.hintBoard.side ? statusH + g + ctlH : colH;
    res.side = colSide <= H - 2 * p ? fitBoard(W - 2 * p - g - panelW, H - 2 * p) : null;
    // side5: som side, men stødet i 5 kolonner og kun 2 rækker knapper (lave skærme, fx mobil på langs)
    var panelW5 = 5 * b + 4 * ig;
    var hudCols5 = (panelW5 - b - ig) >= 4 * 74 + 3 * ig ? 4 : 2, hudRows5 = 4 / hudCols5;
    var statusH5 = Math.max(b, hudRows5 * hudH + (hudRows5 - 1) * ig);
    var ctlH5 = head + 2 * b + 2 * ig, colH5 = statusH5 + g + hint + ig + ctlH5;
    // (beskedlinjen står altid ved knapperne her: på et smalt bord ville den dække kuglerne)
    res.hintBoard.side5 = false;
    res.panelW5 = panelW5; res.hudCols5 = hudCols5; res.hudHc5 = hudRows5 === 2 ? Math.max(40, (statusH5 - ig) / 2) : statusH5;
    res.side5 = colH5 <= H - 2 * p ? fitBoard(W - 2 * p - g - panelW5, H - 2 * p) : null;
    res.below = panelW <= W - 2 * p ? fitBoard(W - 2 * p, H - 2 * p - colH - g) : null;
    LAYOUTS.forEach(function (l) { if (!res[l] || res[l].k * BH < 140) res[l] = null; });
    // Højkant: knapperne ligger under bordet, når der er plads til det
    if (H > W && res.below) { res.wide = res.side = res.side5 = null; }
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
    var five = lay === 'side5';
    ['wide', 'side', 'below'].forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === (five ? 'side' : lay)); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    gridEl.classList.toggle('ctl4', lay !== 'wide');
    gridEl.classList.toggle('ctl5', five);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ig', res.ig + 'px');
    st.setProperty('--head-h', res.head + 'px');
    st.setProperty('--hint-h', (lay === 'wide' ? res.hintWide : res.hint) + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--ctrl-w', Math.floor(res.ctrlW) + 'px');
    st.setProperty('--hud-h', Math.round(lay === 'wide' ? res.hudH : five ? res.hudHc5 : res.hudHc) + 'px');
    st.setProperty('--hud-cols', lay === 'wide' ? 1 : five ? res.hudCols5 : res.hudCols);
    st.setProperty('--board-w', f.w + 'px');
    st.setProperty('--board-h', f.h + 'px');
    st.setProperty('--panel-w', Math.floor(lay === 'below' ? Math.min(v.W - 2 * res.p, Math.max(res.panelW, f.w)) : five ? res.panelW5 : res.panelW) + 'px');
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
    // Sikkerhedsnet: bordet gøres lidt mindre, til alt kan ses
    for (var t = 0; t < 30 && (overflows(gameEl) || overflows(root)) && f.k > 0.1; t++) {
      var k = f.k * 0.96;
      f = f.h > f.w ? { w: Math.floor(BH * k), h: Math.floor(BW * k), k: k } : { w: Math.floor(BW * k), h: Math.floor(BH * k), k: k };
      applyLayout(lay, b, f, res, v);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    renderTable();
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('billard-lille', small);
    root.classList.toggle('billard-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('billard-tvaers')) ? opts.navBottom : opts.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('billard-tvaers')) {
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
  BillardTegn.installerIkoner();
  syncSmall();
  syncFine();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');
  drawMenuDemo();

  // Til test og fejlfinding
  window.Billard = {
    askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get run() { return run; }, get rolling() { return rolling; }, get tegn() { return tegn; },
    get cpuPhase() { return cpuPhase; }, get paused() { return paused; }, get finished() { return finished; },
    get hint() { return $('#hint').textContent; },
    // Hurtig computer i test: setDelays(0, 0, 0)
    setDelays: function (think, aim, after) { CPU_THINK = think; CPU_AIM = aim; AFTER_PAUSE = after; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, logik: L, ai: AI,
    start: startGame, show: show, shoot: shoot, turn: turnAim, power: changePower, aimAt: aimAtScreen,
    nextBall: nextBall, moveCue: moveCue, next: nextFrame, finish: finish, showDone: showDone, refresh: refresh,
    setPaused: setPaused, layout: layoutGame,
    // Efter run._setBalls i en test: start turen (computeren går i gang, hvis det er dens tur)
    begin: function () { clearTimers(); cpuPhase = null; setNote('', ''); beginTurn(); }
  };
})();
