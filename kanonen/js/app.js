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
  var doed = KanonenDoed.create($('#fx'));   // dødseffekten (pixelblokke over hele skærmen)
  // Lydene kommer fra det fælles lydmodul. Kanonen bruger disse navne:
  var SFX = { fall: 'obstacle', fire: 'obstacle', impact: 'crash', hit: 'eat', win: 'bonus', bomb: 'bonusSpawn', granat: 'bonusGone', record: 'record', click: 'click', step: 'click', pause: 'pause', turn: 'move' };
  function sfx(name) { audio.play(SFX[name] || name); }

  function unlockAudio() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true); // TD Browse m.fl. kan klikke uden pointerdown
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
    fitCurrent();
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
  function busy() { return !!(scene.flight || falls.length || aim || timers.length || scene.effects.length || shake || doed.active()); }
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
      doed.draw(clock);
      applyShake();
    }
    if (busy() && run) raf = requestAnimationFrame(frame);
  }
  function draw() { if (current === 'game' && scene.match) view.draw(scene); }

  // ---------- Spillet ----------
  // run: hele spillet (mange modstandere). match: den aktuelle kamp.
  var run = null, paused = false;
  var phase = 'idle'; // aim (din tur), flight, cpu (computeren sigter), wait, win, over

  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
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
    doed.clear(); shake = null; $('#game-layout').style.transform = '';
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
      scene.effects.push({ kind: 'dmg', x: d.cannon.x, cy: d.cannon.y, off: 200, text: '−' + d.amount, color: isPlayer ? view.rgba(cssVar('--kn-player'), 1) : view.rgba(cssVar('--kn-cpu'), 1), t0: clock + 150, dur: 1600, calm: calm });
      if (d.cannon !== f.shooter) hitOther = true;
      if (f.shooter === m.player && d.cannon === m.cpu) { run.score += d.amount * G.RULES.pointsPerDamage; m.damageDealt += d.amount; }
      msg.push((isPlayer ? 'Du' : 'Modstanderen') + ' mistede ' + d.amount + ' liv');
    });
    if (hitOther) after(260, function () { sfx('hit'); });
    m.cannons.forEach(function (c) { if (c.hp <= 0 && !c.dead) after(calm ? 300 : 180, function () { kill(c); }); });
    line.textContent = msg.length ? msg.join(' · ') : (f.ammo === 'bombe' ? 'Bomben ramte jorden' : 'Granaten ramte jorden');
    // Kanoner, der har mistet jorden under sig, falder ned i krateret.
    m.cannons.forEach(function (c) {
      var y = G.restY(m, c);
      if (y > c.y + 0.5 && c.hp <= 0) c.y = y; // ødelagt kanon: vraget lægger sig bare i krateret
      else if (y > c.y + 0.5) {
        var fl = { c: c, from: c.y, to: y, v: 0, shooter: f.shooter };
        if (calm) { c.y = y; after(450, function () { fallLanded(fl); }); } else falls.push(fl);
      }
    });
    refresh();
    after(calm ? 1100 : 1300, resolve);
  }
  function stepFalls(dt) {
    falls = falls.filter(function (fl) {
      fl.v = Math.min(420, fl.v + 900 * dt);
      fl.c.y = Math.min(fl.to, fl.c.y + fl.v * dt);
      if (fl.c.y < fl.to) return true;
      fallLanded(fl);
      return false;
    });
  }
  // Faldskade: jo dybere fald, jo mere skade (se G.fallDamage). Point, hvis spillerens skud fik modstanderen til at falde.
  function fallLanded(fl) {
    var m = scene.match, c = fl.c, n = Math.min(c.hp, G.fallDamage(fl.to - fl.from));
    if (n <= 0) return;
    c.hp -= n;
    var isPlayer = c === m.player;
    if (fl.shooter === m.player && c === m.cpu) { run.score += n * G.RULES.pointsPerDamage; m.damageDealt += n; }
    sfx('fall');
    scene.effects.push({ kind: 'dmg', x: c.x, cy: c.y, off: 252, text: '−' + n + ' fald', color: view.rgba(cssVar(isPlayer ? '--kn-player' : '--kn-cpu'), 1), t0: clock, dur: 1600, calm: !animationOn() });
    var line = $('#turn-line'), add = (isPlayer ? 'Du' : 'Modstanderen') + ' faldt og mistede ' + n + ' liv';
    line.textContent = /liv$|jorden$/.test(line.textContent) ? line.textContent + ' · ' + add : add;
    refresh();
    if (c.hp <= 0) after(150, function () { kill(c); });
  }

  // ---------- Dødseffekt ----------
  // Kanonen splittes i pixelblokke, der flyver ud over skærmen (eller opløses roligt uden animation).
  var shake = null;
  function kill(c) {
    var m = scene.match;
    if (!m || c.dead) return;
    c.dead = true;
    var isPlayer = c === m.player, calm = !animationOn();
    var cv = $('#field').getBoundingClientRect(), gr = $('#game').getBoundingClientRect(), sc = cv.width / G.WORLD.w;
    function P(x, y) { return { x: cv.left - gr.left + x * sc, y: cv.top - gr.top + y * sc }; }
    var mz = G.muzzle(c), foot = P(c.x, c.y), b1 = P(c.x, c.y - 22), b2 = P(mz.x, mz.y);
    doed.start({ x: foot.x, y: foot.y, scale: sc, now: clock, calm: calm,
      color: cssVar(isPlayer ? '--kn-player' : '--kn-cpu'), accent: cssVar('--kn-ground'),
      barrel: { x1: b1.x, y1: b1.y, x2: b2.x, y2: b2.y } });
    if (!calm) shake = { t0: clock, dur: 480, amp: Math.max(3, Math.min(8, 0.012 * Math.min(innerWidth, innerHeight))) };
    // lyd: et tungt brag, en dyb rumlen – og en faldende tone, når det er din kanon
    sfx('impact');
    after(110, function () { sfx('fall'); });
    after(isPlayer ? 380 : 300, function () { sfx(isPlayer ? 'granat' : 'fall'); });
    $('#turn-line').textContent = isPlayer ? 'Din kanon er ødelagt' : 'Modstander ' + m.no + ' er ødelagt!';
    refresh(); draw(); kick();
  }
  // Lille, dæmpet skærmrystelse (kun med animation). Ingen lysændringer.
  function applyShake() {
    var el = $('#game-layout');
    if (!shake) return;
    var k = (clock - shake.t0) / shake.dur;
    if (k >= 1 || paused) { el.style.transform = ''; shake = null; return; }
    var a = shake.amp * (1 - k) * (1 - k), t = (clock - shake.t0) / 1000;
    el.style.transform = 'translate(' + (a * Math.sin(t * Math.PI * 2 * 11)).toFixed(1) + 'px,' + (a * Math.sin(t * Math.PI * 2 * 8 + 1)).toFixed(1) + 'px)';
  }

  function resolve() {
    var m = scene.match;
    // vent på fald og på, at dødseffekten er helt færdig, før sejr/game over vises
    if (falls.length || doed.active() || m.cannons.some(function (c) { return c.hp <= 0 && !c.dead; })) { after(100, resolve); return; }
    refresh(); draw();
    if (m.player.dead) {
      if (m.cpu.dead) { run.wins++; run.score += G.winPoints(m.no, m.shots); }
      run.over = true; setPhase('over');
      $('#turn-line').textContent = 'Din kanon er ødelagt';
      after(450, gameOver);
    } else if (m.cpu.dead) {
      setPhase('win');
      $('#turn-line').textContent = 'Modstander ' + m.no + ' er ødelagt!';
      after(350, matchWon);
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
    if (!run || run.over || !$('#win-overlay').hidden || doed.active()) return;
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
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
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

  // ---------- Layout: alt skaleres til vinduet, intet ruller ----------
  // Spilleskærmen beregnes her: for hver variant (panel ved siden af eller under slagmarken,
  // værdien over eller midt mellem knapperne, de to knaprækker under eller ved siden af hinanden)
  // findes den største knapstørrelse, der kan være der, og den variant vælges, der giver knapper
  // tættest på 3 cm og samtidig den største slagmark. Spillets logik kender kun banens egne
  // koordinater (1600 × 900), så visningsstørrelsen påvirker aldrig fysikken.
  var CM = 96 / 2.54, CM3 = 3 * CM;
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function gameMetrics(W, H) {
    var pad = clampN(Math.min(W, H) * 0.016, 6, 18);
    var gameGap = clampN(Math.min(W, H) * 0.025, 8, 28);
    var capS = Math.max(CM3, Math.min(150, 0.125 * Math.min(W, H)));
    var best = null, perVariant = {};
    var variants = [];
    ['side', 'bottom', 'split'].forEach(function (mode) {
      [false, true].forEach(function (inline) {
        [false, true].forEach(function (pair) {
          [false, true].forEach(function (pauseFull) {
            if (mode !== 'bottom' && pair) return;
            if (mode === 'split' && inline) return;
            variants.push({ mode: mode, inline: inline, pair: pair, pauseFull: pauseFull });
          });
        });
      });
    });
    variants.forEach(function (v) {
      for (var s = Math.floor(capS); s >= 30; s--) {
        var g = clampN(0.15 * s, 6, 20);
        var turnH = clampN(0.36 * s, 26, 46);
        var headH = v.inline ? 0 : clampN(0.36 * s, 22, 46);
        var topH = v.pauseFull ? s : clampN(0.62 * s, 40, 84);
        var panelW, bw, fw, fh, ok, hudCols, hudH, hudBlock, ctrlH, ctrlsH, colW = 0;
        if (v.mode === 'split') {
          // Vinkel til venstre og krudt til højre for slagmarken (2 × 2 knapper hver), HUD over og statuslinje under.
          bw = s; colW = 2 * s + g;
          hudCols = 4; hudH = clampN(0.5 * s, 36, 70); headH = clampN(0.3 * s, 20, 40);
          var leftH = topH + g + headH + 4 + 2 * s + g;
          var rightH = headH + 4 + 2 * s + g + g + s;
          if (Math.max(leftH, rightH) > H - 2 * pad) continue;
          fw = Math.min(W - 2 * pad - 2 * colW - 2 * gameGap, (H - 2 * pad - hudH - turnH - 2 * g) * 16 / 9);
          fh = fw * 9 / 16; panelW = fw;
          ok = fw >= Math.max(220, W * 0.4) && (fw - 3 * 8) / 4 >= 80;
        } else {
          if (v.mode === 'side') {
            bw = s;
            panelW = v.inline ? 5.3 * bw + 4 * g : 4 * bw + 3 * g;
          } else {
            panelW = Math.min(W - 2 * pad, (v.pair ? 2 : 1) * (v.inline ? 5.3 : 4) * 1.6 * s + 12 * g);
            var groupW = v.pair ? (panelW - g) / 2 : panelW;
            bw = v.inline ? (groupW - 4 * g) / 5.3 : (groupW - 3 * g) / 4;
            if (s > bw * 1.1) continue;  // knapperne må ikke blive højere end brede
          }
          hudCols = (panelW - 3 * 8) / 4 >= 88 ? 4 : 2;
          hudH = clampN((hudCols === 4 ? 0.62 : 0.5) * s, 40, 84);
          hudBlock = hudCols === 4 ? hudH : 2 * hudH + 8;
          ctrlH = (headH ? headH + 4 : 0) + s;
          ctrlsH = v.pair ? ctrlH : 2 * ctrlH + g;
          if (v.mode === 'side') {
            var panelH = topH + g + hudBlock + g + turnH + g + ctrlsH + g + s;
            if (panelH > H - 2 * pad) continue;
            fw = Math.min(W - 2 * pad - panelW - gameGap, (H - 2 * pad) * 16 / 9);
            fh = fw * 9 / 16;
            ok = fw >= Math.max(220, W * 0.38);
          } else {
            var rest = topH + g + g + hudBlock + g + turnH + g + ctrlsH + g + s;
            fh = Math.min(H - 2 * pad - rest, (W - 2 * pad) * 9 / 16);
            fw = fh * 16 / 9;
            ok = fh >= Math.max(110, H * 0.2);
          }
        }
        if (!ok) continue;
        var sEff = Math.min(s, bw), pause = v.pauseFull ? s : topH;
        var score = Math.min(sEff, CM3) / CM3 + 1.3 * (fw * fh) / (W * H) +
          0.05 * Math.min(sEff, 160) / 160 + 0.3 * Math.min(pause, CM3) / CM3;
        var vk = v.mode + (v.inline ? '+inline' : '') + (v.pair ? '+pair' : '') + (v.pauseFull ? '+pause' : '');
        if (!perVariant[vk] || score > perVariant[vk].score) perVariant[vk] = { score: +score.toFixed(3), s: s, fw: Math.round(fw) };
        if (!best || score > best.score) {
          best = { score: score, v: v, s: s, bw: bw, g: g, turnH: turnH, headH: headH, topH: topH, panelW: panelW,
            hudCols: hudCols, hudH: hudH, fw: fw, fh: fh, pad: pad, gameGap: gameGap, colW: colW };
        }
      }
    });
    if (!best) { // nødløsning til meget små vinduer: alt i mindste størrelse under hinanden
      var s0 = 30, g0 = 6;
      best = { v: { mode: 'bottom', inline: true, pair: false, pauseFull: false }, s: s0, bw: s0, g: g0, turnH: 26, headH: 0, topH: 40,
        panelW: W - 12, hudCols: 4, hudH: 40, pad: 6, gameGap: 6 };
      best.fh = Math.max(60, H - 12 - (40 + 40 + 26 + 2 * s0 + g0 + s0 + 7 * g0)); best.fw = Math.min(W - 12, best.fh * 16 / 9); best.fh = best.fw * 9 / 16;
    }
    best.variants = perVariant;
    return best;
  }
  var lastMetrics = null;
  function layoutGame() {
    if (current !== 'game') return;
    var W = window.innerWidth, H = window.innerHeight, m = gameMetrics(W, H);
    lastMetrics = m;
    var lay = $('#game-layout'), v = m.v;
    lay.classList.toggle('mode-side', v.mode === 'side');
    lay.classList.toggle('mode-bottom', v.mode === 'bottom');
    lay.classList.toggle('inline', v.inline);
    lay.classList.toggle('pair', v.pair);
    lay.classList.toggle('s-small', m.s < 84);
    lay.classList.toggle('hud-small', m.hudH < 64);
    lay.classList.toggle('top-small', m.topH < 70);
    var set = function (k, val) { lay.style.setProperty(k, Math.floor(val) + 'px'); };
    set('--s', m.s); set('--g', m.g); set('--turn-h', m.turnH); set('--head-h', m.headH); set('--top-h', m.topH);
    set('--panel-w', m.panelW); set('--hud-h', m.hudH); set('--game-gap', m.gameGap); set('--pad', m.pad);
    lay.style.setProperty('--hud-cols', m.hudCols);
    lay.classList.toggle('mode-split', v.mode === 'split');
    placeSplit(m, W, H);
    var fw = Math.floor(m.fw) - 6; // 3 px kant på hver side
    view.resize(fw, Math.round(fw * 9 / 16));
  }
  // Delt layout: hver del placeres præcist (venstre: logo, pause og vinkel; midt: HUD, slagmark og
  // statuslinje; højre: krudt, ammunition og Skyd). I de andre layouts klarer CSS'en placeringen.
  var SPLIT_PARTS = ['.side-top', '.hud-grid', '#turn-line', '#ctrl-angle', '#ctrl-power', '.fire-row', '#field-wrap'];
  function placeSplit(m, W, H) {
    SPLIT_PARTS.forEach(function (q) { var e = $(q); ['left', 'top', 'width', 'height'].forEach(function (k) { e.style[k] = ''; }); });
    if (m.v.mode !== 'split') return;
    var s = m.s, g = m.g, cw = m.colW, fw = Math.floor(m.fw), fh = Math.round(m.fw * 9 / 16);
    var totalW = 2 * cw + fw + 2 * m.gameGap, x0 = Math.max(m.pad, (W - totalW) / 2);
    var cx = x0 + cw + m.gameGap, rx = cx + fw + m.gameGap;
    var leftH = m.topH + g + m.headH + 4 + 2 * s + g, rightH = m.headH + 4 + 2 * s + g + g + s;
    var midH = m.hudH + g + fh + g + m.turnH;
    var ly = (H - leftH) / 2, ry = (H - rightH) / 2, my = (H - midH) / 2;
    function put(q, x, y, w, h) { var e = $(q); e.style.left = Math.round(x) + 'px'; e.style.top = Math.round(y) + 'px'; e.style.width = Math.round(w) + 'px'; if (h != null) e.style.height = Math.round(h) + 'px'; }
    put('.side-top', x0, ly, cw, m.topH);
    put('#ctrl-angle', x0, ly + m.topH + g, cw, m.headH + 4 + 2 * s + g);
    put('#ctrl-power', rx, ry, cw, m.headH + 4 + 2 * s + g);
    put('.fire-row', rx, ry + m.headH + 4 + 2 * s + 2 * g, cw, s);
    put('.hud-grid', cx, my, fw, m.hudH);
    put('#field-wrap', cx, my + m.hudH + g, fw, fh);
    put('#turn-line', cx, my + m.hudH + g + fh + g, fw, m.turnH);
  }

  // Øvrige skærme (menu, indstillinger, rekorder, om, game over og spillets overlays):
  // passer indholdet ikke, skaleres tekst, knapper og afstande trinvis ned (--kfit) – aldrig rulning.
  function overflows(el) {
    if (!el || el.hidden) return false;
    if (el.classList.contains('overlay')) {
      var p = el.querySelector('.panel').getBoundingClientRect();
      return p.top < 0 || p.left < 0 || p.bottom > window.innerHeight || p.right > window.innerWidth;
    }
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }
  function fitTo(el) {
    var k = 1;
    root.style.setProperty('--kfit', '1');
    while (k > 0.36 && overflows(el)) { k = Math.round((k - 0.03) * 100) / 100; root.style.setProperty('--kfit', String(k)); }
  }
  function fitCurrent() {
    if (!current) return;
    if (current === 'game') {
      layoutGame(); draw();
      var ov = ['#pause-overlay', '#win-overlay'].map(function (q) { return $(q); }).filter(function (o) { return !o.hidden; })[0];
      fitTo(ov || null);
    } else {
      fitTo($('#' + current));
    }
  }
  var fitQueued = false;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(function () { fitQueued = false; fitCurrent(); });
  }
  window.addEventListener('resize', queueFit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);
  // Når en skærm, fane eller et overlay vises/skjules, eller lister fyldes, tilpasses der igen.
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      if (list[i].type === 'attributes' || t.id === 'rec-list' || t.id === 'go-records' || t.id === 'menu-best') { queueFit(); return; }
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });


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
    get paused() { return paused; }, get layout() { return lastMetrics; }, get fxCount() { return doed.count(); }, get fxActive() { return doed.active(); }, get busy() { return busy(); },
    settings: arkade, gameSettings: kanon, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, adjust: adjust, toggleAmmo: toggleAmmo,
    fire: function () { if (phase === 'aim') fire(scene.match.player); },
    // Sætter sigtet direkte (test): vinkel og krudt
    aimAt: function (angle, power) { var p = scene.match.player; p.angle = G.clamp(Math.round(angle), G.LIMITS.angleMin, G.LIMITS.angleMax); p.power = G.clamp(Math.round(power), G.LIMITS.powerMin, G.LIMITS.powerMax); refresh(); draw(); }
  };
})();
