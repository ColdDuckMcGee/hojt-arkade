/*
 * Kanonen – brugerflade: skærme, input, tur-rækkefølge, computeren,
 * indstillinger, lyd og rekorder. Bygger på de fælles moduler i ../arkade/
 * ligesom Slangen og Minestryger.
 *
 * Al tid i spillet går gennem et spil-ur, der står stille under pause, så
 * intet sker, mens spilleren holder pause.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.KanonenGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // Spillets egne: den sidste vinkel og det sidste krudt huskes til næste spil.
  var kanon = ArkadeSettings.create('kanonen', { angle: 45, power: 60 });
  var records = ArkadeHighscores.create('kanonen', { max: 10 });
  var CATEGORY = 'uendelig';

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  kanon.set('angle', G.clamp(Math.round(kanon.get('angle')), G.LIMITS.angleMin, G.LIMITS.angleMax));
  kanon.set('power', G.clamp(Math.round(kanon.get('power')), G.LIMITS.powerMin, G.LIMITS.powerMax));

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  var view = KanonenRender.create($('#field'));
  // Lydene kommer fra det fælles lydmodul. Kanonen bruger disse navne:
  var SFX = { fire: 'obstacle', impact: 'crash', hit: 'eat', win: 'bonus', bomb: 'bonusSpawn', granat: 'bonusGone', record: 'record', click: 'click', step: 'click', pause: 'pause', turn: 'move' };
  function sfx(name) { audio.play(SFX[name] || name); }

  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });

  // ---------- Tema og baggrund ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function animationOn() { return arkade.get('animation') && !reducedMotionMq.matches; }
  function readColors() {
    view.setColors({
      player: cssVar('--kn-player'), cpu: cssVar('--kn-cpu'),
      ground: cssVar('--kn-ground'), groundFill0: cssVar('--kn-ground-fill0'), groundFill1: cssVar('--kn-ground-fill1'),
      gridAlpha: parseFloat(cssVar('--kn-grid-alpha')) || 0.2,
      sky0: cssVar('--kn-sky0'), sky1: cssVar('--kn-sky1'), sun0: cssVar('--kn-sun0'), sun1: cssVar('--kn-sun1'),
      sunAlpha: parseFloat(cssVar('--kn-sun-alpha')) || 0.8, star: cssVar('--kn-star'),
      boom: cssVar('--kn-boom'), boom2: cssVar('--kn-boom2'), wind: cssVar('--kn-wind'),
      cannonFill: cssVar('--kn-cannon-fill'), text: cssVar('--ui-text'),
      font: cssVar('--font') || 'sans-serif', glow: cssVar('--glow') !== '0'
    });
  }
  function applyTheme() {
    root.setAttribute('data-theme', arkade.get('theme'));
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = cssVar('--bg');
    bg.setPalette({
      bg0: cssVar('--p-bg0'), bg1: cssVar('--p-bg1'), sky0: cssVar('--p-sky0'), sky1: cssVar('--p-sky1'),
      sky2: cssVar('--p-sky2'), sun0: cssVar('--p-sun0'), sun1: cssVar('--p-sun1'), grid: cssVar('--p-grid'),
      light1: cssVar('--p-light1'), light2: cssVar('--p-light2')
    });
    readColors();
    draw();
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    root.classList.toggle('kn-calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og nedslagene. Fra giver en rolig fade';
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
    if (id === 'game') { layoutGame(); draw(); }
    if (id === 'menu') syncMenu();
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function winsText(n) { return n === 1 ? '1 sejr' : n + ' sejre'; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // ---------- Startmenu ----------
  function syncMenu() {
    var best = records.list(CATEGORY)[0];
    $('#menu-best').textContent = best ? 'Rekord: ' + fmt(best.score) + ' point · ' + winsText(best.wins || 0) : '';
  }
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, kanon].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
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
  function onFs() { syncFullscreen(); layoutGame(); draw(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spil-ur og animation ----------
  // clock: spillets egen tid i ms. Den står stille under pause.
  var clock = 0, lastFrame = 0, raf = 0, timers = [];
  var scene = { match: null, active: null, flight: null, effects: [], now: 0 };
  var falls = [];       // kanoner, der falder ned i et krater
  var aim = null;       // computerens synlige sigte: { from, to, t0, dur }
  var FLIGHT_SPEED = 0.85, DT = 1 / 120;

  function after(ms, fn) { timers.push({ at: clock + ms, fn: fn }); kick(); }
  function busy() { return !!(scene.flight || falls.length || aim || timers.length || scene.effects.length); }
  function kick() { if (!raf) { lastFrame = 0; raf = requestAnimationFrame(frame); } }
  function frame(t) {
    raf = 0;
    var dtMs = lastFrame ? Math.min(50, t - lastFrame) : 16;
    lastFrame = t;
    if (!paused && current === 'game') {
      clock += dtMs;
      scene.now = clock;
      stepFlight(dtMs / 1000);
      stepFalls(dtMs / 1000);
      stepAim();
      var due = timers.filter(function (x) { return x.at <= clock; });
      timers = timers.filter(function (x) { return x.at > clock; });
      due.forEach(function (x) { x.fn(); });
      draw();
    }
    if (busy() && run) raf = requestAnimationFrame(frame);
  }
  function draw() { if (current === 'game' && scene.match) view.draw(scene); }

  // ---------- Spillet ----------
  // run: hele spillet (mange modstandere). match: den aktuelle kamp.
  var run = null, paused = false;
  var phase = 'idle'; // aim (din tur), flight, cpu (computeren sigter), wait, win, over

  function startGame() {
    resetAnim();
    run = { no: 1, score: 0, wins: 0, hp: G.RULES.maxHp, over: false };
    paused = false;
    newMatch();
    show('game');
    $('#btn-fire').focus({ preventScroll: true });
  }
  function resetAnim() {
    timers = []; falls = []; aim = null;
    scene.flight = null; scene.effects = [];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function newMatch() {
    resetAnim();
    var m = G.createMatch(run.no, run.hp);
    m.player.angle = kanon.get('angle'); m.player.power = kanon.get('power');
    m.cpu.angle = 45;
    scene.match = m;
    view.newSky(run.no * 7919 + 13);
    $('#pause-overlay').hidden = true;
    $('#win-overlay').hidden = true;
    playerTurn(true);
  }

  function setPhase(p) {
    phase = p;
    var m = scene.match;
    scene.active = p === 'aim' ? 'spiller' : p === 'cpu' ? 'computer' : null;
    var line = $('#turn-line');
    line.classList.toggle('cpu', p === 'cpu');
    line.classList.toggle('wait', p !== 'aim' && p !== 'cpu');
    if (p === 'aim') line.textContent = 'Din tur – sigt og skyd';
    else if (p === 'cpu') line.textContent = 'Modstander ' + m.no + ' sigter …';
    refresh();
  }

  function refresh() {
    var m = scene.match;
    if (!m) return;
    var p = m.player, c = m.cpu;
    $('#hud-hp').textContent = Math.max(0, p.hp);
    $('#hud-hp-bar').style.width = Math.max(0, p.hp) + '%';
    $('#hud-cpu-label').textContent = 'Modstander ' + m.no;
    $('#hud-cpu-hp').textContent = Math.max(0, c.hp);
    $('#hud-cpu-bar').style.width = Math.max(0, c.hp) + '%';
    $('#hud-score').textContent = fmt(run.score);
    var w = m.wind, arrow = $('#hud-wind-arrow');
    $('#hud-wind').textContent = Math.abs(w);
    arrow.classList.toggle('left', w < 0);
    arrow.classList.toggle('none', w === 0);
    $('#hud-wind-sub').textContent = w === 0 ? 'vindstille' : w > 0 ? 'blæser mod højre' : 'blæser mod venstre';
    $('#angle-value').textContent = p.angle + '°';
    $('#power-value').textContent = p.power + ' %';
    // Knapper kan kun vælges i din tur (deaktiverede knapper springes over af dwell).
    var mine = phase === 'aim' && !paused;
    $$('#game .btn.step').forEach(function (b) {
      var key = b.dataset.adj, d = Number(b.dataset.step), v = p[key];
      var lo = key === 'angle' ? G.LIMITS.angleMin : G.LIMITS.powerMin, hi = key === 'angle' ? G.LIMITS.angleMax : G.LIMITS.powerMax;
      b.disabled = !mine || (d < 0 ? v <= lo : v >= hi);
    });
    $('#btn-fire').disabled = !mine;
    var ab = $('#btn-ammo');
    ab.dataset.ammo = p.ammo;
    ab.disabled = !mine || (p.bombs === 0 && p.ammo === 'granat');
    $('#ammo-use').setAttribute('href', p.ammo === 'bombe' ? '#kn-bombe' : '#kn-granat');
    $('#ammo-name').textContent = p.ammo === 'bombe' ? 'Stor bombe' : 'Granat';
    $('#ammo-sub').textContent = p.ammo === 'bombe'
      ? (p.bombs === 1 ? 'sidste bombe · skift' : p.bombs + ' tilbage · skift')
      : (p.bombs ? 'Skift til bombe (' + p.bombs + ')' : 'Ingen bomber tilbage');
    ab.setAttribute('aria-label', p.ammo === 'bombe'
      ? 'Ammunition: stor bombe, ' + p.bombs + ' tilbage. Vælg for at skifte til granat.'
      : 'Ammunition: granat. ' + (p.bombs ? 'Vælg for at skifte til stor bombe, ' + p.bombs + ' tilbage.' : 'Ingen bomber tilbage.'));
  }

  // ---------- Din tur ----------
  function playerTurn(first) {
    var m = scene.match;
    if (!first) m.wind = G.newWind();
    setPhase('aim');
    draw();
  }
  function adjust(key, d) {
    if (phase !== 'aim' || paused) return;
    var p = scene.match.player;
    var lo = key === 'angle' ? G.LIMITS.angleMin : G.LIMITS.powerMin, hi = key === 'angle' ? G.LIMITS.angleMax : G.LIMITS.powerMax;
    var v = G.clamp(p[key] + d, lo, hi);
    if (v === p[key]) return;
    p[key] = v;
    kanon.set(key, v);
    sfx('step');
    refresh();
    draw();
  }
  $$('#game .btn.step').forEach(function (b) {
    b.addEventListener('click', function () { adjust(b.dataset.adj, Number(b.dataset.step)); });
  });
  function toggleAmmo() {
    if (phase !== 'aim' || paused) return;
    var p = scene.match.player;
    if (p.ammo === 'granat' && p.bombs > 0) { p.ammo = 'bombe'; sfx('bomb'); }
    else if (p.ammo === 'bombe') { p.ammo = 'granat'; sfx('granat'); }
    refresh();
  }
  $('#btn-ammo').addEventListener('click', toggleAmmo);
  $('#btn-fire').addEventListener('click', function () { if (phase === 'aim' && !paused) fire(scene.match.player); });

  // ---------- Skud ----------
  function fire(shooter) {
    var m = scene.match;
    var ammo = shooter.ammo;
    lastShooter = shooter.id;
    if (ammo === 'bombe') shooter.bombs--;
    if (shooter === m.player) m.shots++;
    m.trails[shooter.id] = null; // den gamle bane for denne kanon forsvinder
    var p = G.launch(shooter, m.wind);
    scene.flight = { p: p, pts: [{ x: p.x, y: p.y }], shooter: shooter, ammo: ammo, acc: 0, n: 0, done: false };
    shooter.ammo = 'granat'; // bomben vælges for ét skud ad gangen
    setPhase('flight');
    $('#turn-line').textContent = shooter === m.player ? 'Kuglen flyver …' : 'Modstanderens kugle flyver …';
    sfx('fire');
    kick();
  }
  function stepFlight(dt) {
    var f = scene.flight;
    if (!f || f.done) return;
    f.acc += dt * FLIGHT_SPEED;
    while (f.acc >= DT && !f.done) {
      f.acc -= DT;
      var r = G.step(f.p, DT, scene.match, f.shooter);
      if (++f.n % 3 === 0 || r) f.pts.push({ x: f.p.x, y: f.p.y });
      if (r) { f.done = true; land(f, r); }
    }
  }

  function land(f, r) {
    var m = scene.match, calm = !animationOn();
    m.trails[f.shooter.id] = f.pts;
    scene.flight = null;
    var line = $('#turn-line');
    if (r.type === 'ude') {
      line.textContent = 'Kuglen fløj ud af banen';
      after(900, nextTurn);
      return;
    }
    var ammo = G.AMMO[f.ammo];
    var dmg = G.impact(m, r, f.ammo);
    sfx('impact');
    var bits = [];
    if (!calm) for (var i = 0; i < 10; i++) { var a = Math.PI * (1 + i / 9); bits.push({ vx: Math.cos(a) * ammo.craterR * 1.6, vy: Math.sin(a) * ammo.craterR * 1.4 }); }
    scene.effects.push({ kind: 'boom', x: r.x, y: r.y, r: ammo.craterR * 1.25, t0: clock, dur: calm ? 900 : 950, calm: calm, bits: bits });
    var hitOther = false, msg = [];
    dmg.forEach(function (d) {
      var isPlayer = d.cannon === m.player;
      scene.effects.push({ kind: 'dmg', x: d.cannon.x, y: d.cannon.y - 200, text: '−' + d.amount, color: isPlayer ? view.rgba(cssVar('--kn-player'), 1) : view.rgba(cssVar('--kn-cpu'), 1), t0: clock + 150, dur: 1600, calm: calm });
      if (d.cannon !== f.shooter) hitOther = true;
      if (f.shooter === m.player && d.cannon === m.cpu) { run.score += d.amount * G.RULES.pointsPerDamage; m.damageDealt += d.amount; }
      msg.push((isPlayer ? 'Du' : 'Modstanderen') + ' mistede ' + d.amount + ' liv');
    });
    if (hitOther) after(260, function () { sfx('hit'); });
    line.textContent = msg.length ? msg.join(' · ') : (f.ammo === 'bombe' ? 'Bomben ramte jorden' : 'Granaten ramte jorden');
    // Kanoner, der har mistet jorden under sig, falder ned i krateret.
    m.cannons.forEach(function (c) {
      var y = G.restY(m, c);
      if (y > c.y + 0.5) { if (calm) c.y = y; else falls.push({ c: c, to: y, v: 0 }); }
    });
    refresh();
    after(calm ? 1100 : 1300, resolve);
  }
  function stepFalls(dt) {
    falls = falls.filter(function (fl) {
      fl.v = Math.min(420, fl.v + 900 * dt);
      fl.c.y = Math.min(fl.to, fl.c.y + fl.v * dt);
      return fl.c.y < fl.to;
    });
  }

  function resolve() {
    if (falls.length) { after(100, resolve); return; }
    var m = scene.match;
    m.cannons.forEach(function (c) { if (c.hp <= 0) c.dead = true; });
    refresh(); draw();
    if (m.player.dead) {
      if (m.cpu.dead) { run.wins++; run.score += G.winPoints(m.no, m.shots); }
      run.over = true; setPhase('over');
      $('#turn-line').textContent = 'Din kanon er ødelagt';
      after(1400, gameOver);
    } else if (m.cpu.dead) {
      setPhase('win');
      $('#turn-line').textContent = 'Modstander ' + m.no + ' er ødelagt!';
      after(1100, matchWon);
    } else {
      nextTurn();
    }
  }
  function nextTurn() {
    if (!run || run.over) return;
    var last = lastShooter;
    lastShooter = null;
    if (last === 'spiller') cpuTurn(); else playerTurn(false);
  }
  var lastShooter = null;

  // ---------- Computerens tur ----------
  function cpuTurn() {
    var m = scene.match;
    m.wind = G.newWind();
    setPhase('cpu');
    sfx('turn');
    var plan = G.aiPlan(m, m.cpu, m.player, m.wind, m.no);
    var useBomb = m.cpu.bombs > 0 && Math.random() < Math.min(0.6, 0.25 + 0.05 * m.no);
    // ca. 1 sekunds synlig tøven: røret drejer roligt mod det nye sigte
    aim = { from: m.cpu.angle, to: plan.angle, fromP: m.cpu.power, toP: plan.power, t0: clock, dur: 1100, bomb: useBomb };
    kick();
  }
  function stepAim() {
    if (!aim) return;
    var m = scene.match, t = Math.min(1, (clock - aim.t0) / aim.dur);
    var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    m.cpu.angle = Math.round(aim.from + (aim.to - aim.from) * e);
    m.cpu.power = Math.round(aim.fromP + (aim.toP - aim.fromP) * e);
    if (t >= 1) {
      var a = aim; aim = null;
      m.cpu.angle = a.to; m.cpu.power = a.toP;
      m.cpu.ammo = a.bomb ? 'bombe' : 'granat';
      $('#turn-line').textContent = 'Modstanderen skyder: ' + a.to + '° · ' + a.toP + ' %' + (a.bomb ? ' · bombe' : '');
      after(250, function () { if (run && !run.over) fire(m.cpu); });
    }
  }

  // ---------- Sejr og ny modstander ----------
  function matchWon() {
    var m = scene.match;
    var wp = G.winPoints(m.no, m.shots);
    run.score += wp;
    run.wins++;
    var healed = Math.min(G.RULES.maxHp, m.player.hp + G.RULES.healBetween) - m.player.hp;
    run.hp = m.player.hp + healed;
    refresh();
    sfx('win');
    var few = Math.max(0, G.RULES.fewShotsLimit - m.shots) * G.RULES.fewShotsBonus;
    $('#win-title').textContent = 'Modstander ' + m.no + ' er besejret!';
    $('#win-bonus').textContent = '+' + fmt(wp) + ' point';
    $('#win-detail').textContent = 'Sejr ' + fmt(G.RULES.winPoints * m.no) + ' · ' + (m.shots === 1 ? '1 skud' : m.shots + ' skud') + (few ? ' · bonus for få skud ' + fmt(few) : '');
    $('#win-heal').textContent = healed > 0 ? 'Du får ' + healed + ' liv tilbage og har nu ' + run.hp + ' liv.' : 'Du har fuldt liv.';
    $('#btn-next-sub').textContent = 'Modstander ' + (m.no + 1) + ' · nyt landskab';
    $('#win-overlay').hidden = false;
    dwell.reset();
    $('#btn-next').focus({ preventScroll: true });
  }
  $('#btn-next').addEventListener('click', function () {
    if (!run || run.over) return;
    sfx('click');
    run.no++;
    newMatch();
    draw();
    $('#btn-fire').focus({ preventScroll: true });
  });

  // ---------- Pause ----------
  function setPaused(p) {
    if (!run || run.over || !$('#win-overlay').hidden) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    dwell.reset();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
    else { kick(); $('#btn-fire').focus({ preventScroll: true }); }
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); quitToMenu(); });
  function quitToMenu() {
    resetAnim(); run = null; scene.match = null; paused = false; phase = 'idle';
    $('#pause-overlay').hidden = true; $('#win-overlay').hidden = true;
    show('menu');
  }

  // ---------- Game over ----------
  var lastEntryId = null;
  function gameOver() {
    var rankText = '';
    lastEntryId = null;
    if (run.score > 0) {
      var res = records.add(CATEGORY, run.score, { wins: run.wins });
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else {
      rankText = 'Ingen point denne gang';
    }
    $('#go-reason').textContent = 'Din kanon blev ødelagt af modstander ' + run.no + '.';
    $('#go-score').textContent = fmt(run.score);
    $('#go-wins').textContent = run.wins === 0 ? 'Ingen modstandere besejret' : winsText(run.wins) + ' – du nåede til modstander ' + (run.wins + 1);
    $('#go-rank').textContent = rankText;
    renderRecordList($('#go-records'), lastEntryId);
    resetAnim();
    show('gameover');
  }
  $('#btn-again').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-go-menu').addEventListener('click', function () { sfx('click'); quitToMenu(); });

  function renderRecordList(ol, highlightId) {
    var list = records.list(CATEGORY);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li');
      var e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var w = typeof e.wins === 'number' ? e.wins : 0;
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(fmt(e.score) + ' point'));
        var ws = document.createElement('span'); ws.className = 'wins'; ws.textContent = ' · ' + winsText(w);
        sc.appendChild(ws);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else {
        li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      }
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
  // Op/ned: vinkel. Højre/venstre: krudt. Skift giver trin på 5.
  var KEYS = { ArrowUp: ['angle', 1], ArrowDown: ['angle', -1], ArrowRight: ['power', 1], ArrowLeft: ['power', -1] };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (paused || !$('#win-overlay').hidden) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      adjust(KEYS[e.key][0], KEYS[e.key][1] * (e.shiftKey ? 5 : 1));
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      if (phase === 'aim') fire(scene.match.player);
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      toggleAmmo();
    } else if ((e.key === 'Enter' || e.key === ' ') && (document.activeElement === document.body || document.activeElement === $('#field'))) {
      e.preventDefault();
      if (phase === 'aim') fire(scene.match.player);
    }
  });

  // ---------- Layout af spilleskærmen ----------
  // Slagmarken er 16:9 og fylder mest muligt; panelet har knapper på mindst 3 × 3 cm.
  var CM = 96 / 2.54;
  function layoutGame() {
    if (current !== 'game') return;
    var W = window.innerWidth, H = window.innerHeight;
    var btn = parseFloat(getComputedStyle($('#btn-fire')).minWidth) || 120;
    var pad = Math.max(10, Math.min(W, H) * 0.016);
    var gap = Math.max(19, Math.min(W, H) * 0.025);
    var stepGap = Math.max(20, gap * 0.8);
    var step = Math.max(3.05 * CM, Math.min(150, btn * 0.8));
    // Panelets højde: top + HUD + turlinje + 2 × (overskrift + knapper) + skyd-række.
    // Er der ikke plads, bliver HUD'en til én række (kompakt), og knapperne krymper aldrig under 3 cm.
    var compact = false;
    function sideH(st, sg) { return st + (compact ? 96 : 190) + (compact ? 40 : 50) + 2 * ((compact ? 40 : 52) + st) + Math.max(3 * CM, st) + 6 * sg; }
    var sideGap = 16;
    while (sideH(step, sideGap) > H - 2 * pad && step > 3.05 * CM) step = Math.max(3.05 * CM, step - 4);
    if (sideH(step, sideGap) > H - 2 * pad) sideGap = 10;
    if (sideH(step, sideGap) > H - 2 * pad) compact = true;
    var sideW = 4 * step + 3 * stepGap;
    var portrait = W - 2 * pad - sideW - gap < Math.min(H - 2 * pad, 520) * 16 / 9 * 0.75;
    var lay = $('#game-layout');
    lay.classList.toggle('portrait', portrait);
    lay.classList.toggle('compact', compact && !portrait);
    lay.style.setProperty('--game-gap', gap + 'px');
    lay.style.setProperty('--side-w', Math.floor(sideW) + 'px');
    lay.style.setProperty('--step', Math.floor(step) + 'px');
    lay.style.setProperty('--step-gap', Math.floor(stepGap) + 'px');
    lay.style.setProperty('--side-gap', sideGap + 'px');
    var availW = portrait ? W - 2 * pad : W - 2 * pad - sideW - gap;
    var availH = portrait ? H - 2 * pad - sideH(step, sideGap) - gap : H - 2 * pad;
    var fw = Math.floor(Math.max(240, Math.min(availW, availH * 16 / 9)) - 6);
    view.resize(fw, Math.round(fw * 9 / 16));
  }
  window.addEventListener('resize', function () { layoutGame(); draw(); });

  // ---------- Start ----------
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Kanonen = {
    get run() { return run; }, get match() { return scene.match; }, get phase() { return phase; },
    get paused() { return paused; }, get busy() { return busy(); },
    settings: arkade, gameSettings: kanon, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, adjust: adjust, toggleAmmo: toggleAmmo,
    fire: function () { if (phase === 'aim') fire(scene.match.player); },
    // Sætter sigtet direkte (test): vinkel og krudt
    aimAt: function (angle, power) { var p = scene.match.player; p.angle = G.clamp(Math.round(angle), G.LIMITS.angleMin, G.LIMITS.angleMax); p.power = G.clamp(Math.round(power), G.LIMITS.powerMin, G.LIMITS.powerMax); refresh(); draw(); }
  };
})();
