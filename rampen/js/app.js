/*
 * Rampen – brugerflade: skærme, input, indstillinger, lyd, fremskridt og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * En tur: vælg vinkel og kraft med de store knapper (forhåndslinjen viser kun starten
 * af buen), og send bilen afsted. Logikken (js/logik.js) regner turen ud i forvejen og
 * stopper på toppen af hvert hop. Her fryser spillet og viser 2–3 valgkort (boost,
 * gem boostet, tag ballonen, næse op/ned …), hver med et usikkert landingsfelt
 * ("ca. 60–90 m"), for vinden er skjult. Bilen kan kun se et stykke frem (udsyn), og
 * banen er ny på hver tur. Når bilen holder stille, giver afstanden mønter, og mønterne
 * bruges i værkstedet. Man kan køre så mange ture, man vil.
 *
 * Logikken ligger i js/logik.js (ingen farver), tegningen i js/tegn.js (læser kun
 * tilstanden), og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.RampenLogik;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // fart: 'rolig' eller 'hurtig' afspilning af flyveturen. gloed: temaets lysskær. taage: tåge ud over udsynet (pynt).
  var gset = ArkadeSettings.create('rampen', { fart: 'rolig', gloed: true, taage: true });
  if (['rolig', 'hurtig'].indexOf(gset.get('fart')) < 0) gset.set('fart', 'rolig');
  var records = ArkadeHighscores.create('rampen', { max: 10 });
  var SPEED = { rolig: 1.6, hurtig: 5 };   // gange virkelig tid

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Fremskridt (opgraderinger og mønter) ----------
  var SAVE_KEY = 'hojtArkade.rampen.fremskridt';
  function loadProgress() {
    try { var raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); } catch (e) { /* fx privat tilstand */ }
  }
  var game = L.createGame(loadProgress());

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell på en handlingsknap = én handling. Samme knap kan først dwelles igen,
  // når blikket har forladt den. Vinkelknapperne gentages (data-dwell-repeat).
  var gazeLock = null, suppress = null;
  var dwell = ArkadeDwell.create({
    enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000,
    onActivate: function (el) {
      if (el.hasAttribute('data-dwell-repeat')) return;
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
  // Dwell-sikre skift: når nye knapper dukker op dér, hvor blikket allerede er,
  // kan knappen ikke dwelles, før blikket har forladt den én gang.
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
  // Klik på en handlingsknap (ignoreres, hvis det er et gentaget dwell på samme knap)
  function onAct(el, fn) { el.addEventListener('click', function (e) { if (!swallowed(el)) fn(e); }); }

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul (alle rolige). Rampen bruger disse navne:
  var SFX = {
    aim: 'move', launch: 'bonusSpawn', freeze: 'pause', boost: 'bonus', coin: 'eat', bonus: 'bonus',
    hit: 'obstacle', crash: 'crash', stop: 'click', buy: 'bonus', record: 'record', click: 'click', pause: 'pause', blocked: 'click'
  };
  // Spillets egne lyde (js/lyd.js, Web Audio). Et tema kan give dem andre klange (RampenTema.lyde).
  var lyd = RampenLyd.create({ sfx: arkade.get('sound'), volume: volumeSetting(), lyde: RampenTema.lyde });
  var LYD = { motor: 'motor', launch: 'opsendelse', boost: 'boost', coin: 'moent', hop: 'hop', landing: 'landing', buy: 'koeb' };
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
    if (tegn) tegn.setSmooth(animationOn());     // kameraets rolige zoom følger samme valg
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse. Turen vises med det samme'
      : 'Bevægelse i baggrunden, og bilen, der kører. Fra viser straks, hvor bilen ender';
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
  function applyGlow() { root.setAttribute('data-rampen-gloed', gset.get('gloed') ? 'til' : 'fra'); restyle(); }
  function applyFog() { root.setAttribute('data-rampen-taage', gset.get('taage') === false ? 'fra' : 'til'); restyle(); }
  gset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'taage') applyFog();
    if (key === 'fart') { tegn.setSpeed(speed()); }
    syncSettingsUi();
  });
  function restyle() {
    RampenTegn.readStyle();
    if (typeof tegn !== 'undefined' && tegn) tegn.restyle();
    drawCars();
  }
  function speed() { return SPEED[gset.get('fart')] || SPEED.rolig; }

  // ---------- Tekster ----------
  function m(n) { return Math.floor(n) + ' m'; }
  function coinsText(n) { return n === 1 ? '1 mønt' : n + ' mønter'; }
  function boostText(n) { return n === 1 ? '1 boost' : n + ' boost'; }
  var BILNAVN = { saebekasse: 'sæbekassebil', folkevogn: 'boblebil', sportsvogn: 'sportsvogn', raketbil: 'raketbil' };
  function carName() { return 'Bil ' + game.p.bil + ' · ' + BILNAVN[game.bilType()]; }

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'menu') syncMenu();
    if (id === 'shop') syncShop();
    if (id === 'game') layoutGame(); else fitScreen($('#' + id), true);
    if (id !== 'game') drawCars();
    guardUnderGaze($('#' + id));
  }

  // ---------- Startmenu ----------
  function drawCars() {
    var st = game.stats(), opts = { type: game.bilType(), vinger: st.vinger, raket: game.p.upg.raket > 0, opg: game.p.upg };
    if (current === 'menu' && $('#menu-bil').offsetParent) RampenTegn.bilBillede($('#menu-bil'), opts);
    if (current === 'shop' && $('#shop-bil').offsetParent) RampenTegn.bilBillede($('#shop-bil'), opts);
  }
  function syncMenu() {
    $('#btn-start-label').textContent = tripInProgress() ? 'Fortsæt turen' : game.p.trips ? 'Kør igen' : 'Kør';
    $('#btn-start-sub').textContent = carName() + (game.p.best ? ' · længst ' + m(game.p.best) : '');
    if (current === 'menu') { fitScreen($('#menu')); drawCars(); }
  }
  $('#btn-start').addEventListener('click', function () { sfx('click'); startTrip(); });
  $('#btn-menu-shop').addEventListener('click', function () { sfx('click'); show('shop'); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  // Tilbage til hallen: stop musikken og gem, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, gset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    saveProgress();
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
    if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { var p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(function () {}); }
  }
  function syncFullscreen() { $$('.js-fs-label').forEach(function (l) { l.textContent = isFullscreen() ? 'Luk fuld skærm' : 'Fuld skærm'; }); }
  $$('.js-fullscreen').forEach(function (b) {
    if (!fsSupported) { b.hidden = true; return; }
    b.addEventListener('click', function () { sfx('click'); toggleFullscreen(); });
  });
  function onFs() { syncFullscreen(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Turen ----------
  // phase: 'launch' (vælg vinkel og kraft), 'fly' (bilen kører), 'freeze' (beslutningspunkt), 'done'
  var phase = 'launch', paused = false, freezeEv = null, opts = null, trail = [], lastCar = null;
  var playing = false, fastNow = false, noteText = '', noteCls = '', lastResult = null;
  var courseEl = $('#course');
  var tegn = RampenTegn.create(courseEl);
  tegn.setSmooth(animationOn());
  var controls = $('#controls');

  // En tur, der blev afbrudt (gemt ved et beslutningspunkt), fortsætter ved det samme valg
  function tripInProgress() { return !!(game.flight && !game.flight.done); }
  function resumeTrip() {
    var f = game.flight;
    paused = false; playing = false; trail = []; fastNow = gset.get('fart') === 'hurtig';
    lastCar = { t: f.t, x: f.x, y: f.y, vx: f.vx, vy: f.vy, hp: f.hp, coins: f.coins, boosts: f.boosts, ground: f.ground, nose: f.nose, hops: f.hops, landings: f.landings, dmg: f.dmg };
    setNote('Turen fortsætter, hvor du slap.', 'ok');
    hideOverlays();
    show('game');
    onSegmentEnd('top');
  }
  function startTrip() {
    tegn.stop();
    if (tripInProgress()) { resumeTrip(); return; }
    game.flight = null;
    phase = 'launch'; paused = false; freezeEv = null; opts = null; trail = []; lastCar = null; playing = false;
    fastNow = gset.get('fart') === 'hurtig';
    setNote('', '');
    hideOverlays();
    show('game');
    refresh();
    sfx('motor');
  }
  var OVERLAYS = ['#pause-overlay', '#result-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function setNote(t, cls) { noteText = t; noteCls = cls || ''; }
  function can(ph) { return current === 'game' && !paused && !overlayOpen() && phase === ph && !playing; }

  function changeAngle(d) {
    if (!can('launch')) return;
    var a = game.p.angle, n = game.setAngle(a + d);
    if (n === a) { sfx('blocked'); setNote(d > 0 ? 'Vinklen er allerede størst (' + L.ANGLE_MAX + '°).' : 'Vinklen er allerede mindst (' + L.ANGLE_MIN + '°).', ''); refresh(); return; }
    sfx('aim'); setNote('', ''); refresh();
  }
  function changePower(d) {
    if (!can('launch')) return;
    var p = game.p.power, n = game.setPower(p + d);
    if (n === p) { sfx('blocked'); setNote(d > 0 ? 'Kraften er allerede størst (10).' : 'Kraften er allerede mindst (1).', ''); refresh(); return; }
    sfx('aim'); setNote('', ''); refresh();
  }
  $$('#controls [data-ang]').forEach(function (b) { b.addEventListener('click', function () { changeAngle(+b.dataset.ang); }); });
  $$('#controls [data-pow]').forEach(function (b) { b.addEventListener('click', function () { changePower(+b.dataset.pow); }); });

  function launch() {
    if (!can('launch')) return;
    var seg = game.launch();
    if (!seg) return;
    sfx('launch');
    trail = [{ x: -L.RAMPE.len * 0.4, y: L.RAMPE.h }];
    play(seg);
  }
  onAct($('#btn-launch'), launch);

  // Afspil et stykke af turen. Uden animation vises slutningen med det samme.
  var lastCoins = 0, lastHp = 0, lastHops = 0, lastLand = 0, lastDmg = 0, curSeg = null;
  // Lyde for det, der skete fra det forrige billede til dette
  function frameSounds(c) {
    if (c.coins > lastCoins) sfx(c.coins - lastCoins >= 10 ? 'bonus' : 'coin');
    if (c.hops > lastHops) sfx('hop');
    var dmg = c.dmg - lastDmg;
    if (c.landings > lastLand) sfx('landing', Math.min(1, dmg / 25));
    else if (dmg > 0.5) sfx('hit');
    lastCoins = c.coins; lastHops = c.hops; lastLand = c.landings; lastDmg = c.dmg; lastHp = c.hp;
  }
  function play(seg) {
    curSeg = seg;
    phase = 'fly'; playing = true; opts = null; freezeEv = null;
    setNote('', '');
    var fr = seg.frames, first = fr[0];
    lastCoins = first.coins; lastHp = first.hp; lastHops = first.hops; lastLand = first.landings; lastDmg = first.dmg;
    var done = function () {
      playing = false;
      var lf = fr[fr.length - 1];
      addTrail(fr, fr.length - 1);
      lastCar = lf;
      frameSounds(lf);
      onSegmentEnd(seg.event);
    };
    refresh();
    if (!animationOn()) { done(); return; }
    var sc = scene();
    var ti = 0;
    tegn.animate(sc, fr, {
      speed: fastNow ? SPEED.hurtig : SPEED.rolig,
      onFrame: function (c, frames, i) {
        lastCar = c;
        if (i > ti) { addTrail(frames, i, ti); ti = i; }
        frameSounds(c);
        hud(c);
      },
      onDone: done
    });
  }
  function addTrail(frames, i, from) {
    for (var k = (from || 0) + 1; k <= i; k++) if (k % 4 === 0 || k === i) { var f = frames[k]; trail.push({ x: f.x, y: f.y }); }
    sceneCache && (sceneCache.trail = trail);
  }
  function onSegmentEnd(ev) {
    if (ev === 'end') { endTrip(); return; }
    freezeEv = ev; phase = 'freeze';
    sfx('freeze');
    opts = game.options();
    saveProgress();                 // turen gemmes ved hvert valg, så den kan fortsætte senere
    refresh();
    guardUnderGaze(controls);
  }
  // Valgkortene: tekst på kortet og en fuld forklaring til skærmlæsere (altid et interval)
  function feltTxt(k) { return 'ca. ' + k.felt.fra + '–' + k.felt.til + ' m'; }
  function skadeKort(k) {
    var st = game.st; if (!st) return '';
    if (k.felt.smadret) return 'Kan smadre bilen';
    var d = Math.round(100 * k.felt.skadeMax / st.maxHp);
    return d >= 5 ? 'Skade op til ' + d + ' %' : '';
  }
  function kortAria(k, i) {
    var sk = skadeKort(k);
    return 'Kort ' + (i + 1) + ': ' + k.titel + '. ' + k.effekt + '. Lander ' + feltTxt(k) + '.' + (sk ? ' ' + sk + '.' : '');
  }
  function renderCards() {
    var list = (phase === 'freeze' && opts) ? opts.kort : [];
    var box = $('#kort-liste');
    box.classList.toggle('n2', list.length === 2);
    box.classList.toggle('n3', list.length === 3);
    $$('.valg-kort', box).forEach(function (b, i) {
      var k = list[i];
      b.hidden = !k;
      if (!k) { b.removeAttribute('data-id'); return; }
      b.dataset.id = k.id;
      b.querySelector('use').setAttribute('href', '#rampen-ikon-' + k.ikon);
      b.querySelector('.kort-titel').textContent = k.titel;
      b.querySelector('.kort-effekt').textContent = k.effekt;
      b.querySelector('.kort-felt').textContent = feltTxt(k);
      b.querySelector('.kort-skade').textContent = skadeKort(k);
      b.setAttribute('aria-label', kortAria(k, i));
    });
  }
  function decide(valg) {
    if (!can('freeze') || !opts) return;
    var id = valg === true ? 'boost' : valg === false ? 'vent' : valg;
    var k = opts.kort.filter(function (x) { return x.id === id; })[0];
    if (!k) { sfx('blocked'); return; }
    if (id === 'boost') sfx('boost'); else sfx('click');
    play(game.decide(id));
  }
  function decideNr(i) { if (opts && opts.kort[i]) decide(opts.kort[i].id); }
  $$('#kort-liste .valg-kort').forEach(function (b) { onAct(b, function () { decideNr(+b.dataset.kort); }); });

  // Hurtigere / roligere og Spring frem, mens bilen kører
  function toggleFast() {
    if (current !== 'game' || phase !== 'fly') return;
    fastNow = !fastNow;
    gset.set('fart', fastNow ? 'hurtig' : 'rolig');
    tegn.setSpeed(fastNow ? SPEED.hurtig : SPEED.rolig);
    sfx('click'); refresh();
  }
  onAct($('#btn-speed'), toggleFast);
  function skipAhead() { if (current === 'game' && phase === 'fly' && playing && !paused) { sfx('click'); tegn.finishNow(); } }
  onAct($('#btn-skip'), skipAhead);
  // Spol hele turen færdig (uden flere boost eller kort)
  function skipToEnd() {
    if (!game.flight) return;
    tegn.stop(); playing = false;
    var guard = 0, seg;
    while (!game.flight.done && guard++ < 500) { seg = game.decide(false); addTrail(seg.frames, seg.frames.length - 1); lastCar = seg.frames[seg.frames.length - 1]; }
    paused = false; hideOverlays();
    if (current !== 'game') show('game');
    endTrip();
  }

  function endTrip() {
    var f = game.flight;
    var r = game.finishTrip();
    if (!r) return;
    phase = 'done';
    lastResult = r;
    var res = records.add('tur', r.dist, { bil: game.p.bil });
    saveProgress();
    if (r.end === 'smadret') sfx('crash'); else sfx('stop');
    $('#res-kicker').textContent = 'Tur ' + game.p.trips + ' · ' + carName();
    $('#res-title').textContent = m(r.dist);
    $('#res-reason').textContent = r.end === 'smadret' ? 'Bilen gik i stykker og blev stående.' : 'Bilen holder stille.';
    $('#res-coins').textContent = '+' + coinsText(r.total);
    var parts = [r.distCoins + ' for afstanden', r.pickCoins + ' samlet op'];
    if (r.spareCoins) parts.push(r.spareCoins + ' for ' + r.spareBoosts + ' ubrugt boost' + (r.spareBoosts === 1 ? '' : 's'));
    r.zoneBonus.forEach(function (z) { parts.push(z.beloen + ' for at nå ' + z.navn.toLowerCase()); });
    r.goals.forEach(function (g) { parts.push(g.beloen + ' for målet "' + g.tekst + '"'); });
    if (game.p.bil > 1) parts.push('Bil ' + game.p.bil + ' giver +' + Math.round((L.multiplier(game.p.bil) - 1) * 100) + ' %');
    $('#res-parts').textContent = parts.join(' · ') + '.';
    var rank = '';
    if (r.newBest && r.dist > 0) { rank = 'Din længste tur med denne bil!'; }
    if (res && res.rank === 1) { rank = 'Ny rekord!'; sfx('record'); }
    else if (res && res.rank > 0 && !rank) rank = 'Nr. ' + res.rank + ' på listen over længste ture';
    $('#res-rank').textContent = rank;
    refresh();
    var ov = $('#result-overlay');
    ov.hidden = false;
    fitScreen(ov);
    dwell.reset();
    guardUnderGaze(ov);
    $('#btn-res-shop').focus({ preventScroll: true });
    return f;
  }
  $('#btn-res-shop').addEventListener('click', function () { sfx('click'); hideOverlays(); show('shop'); });
  $('#btn-res-again').addEventListener('click', function () { sfx('click'); startTrip(); });
  $('#btn-res-menu').addEventListener('click', function () { sfx('click'); hideOverlays(); show('menu'); });

  // ---------- Pause ----------
  function setPaused(p) {
    if (current !== 'game' || phase === 'done') return;
    paused = p;
    if (p) tegn.stop(); // stykket afspilles igen fra beslutningen, men logikken er allerede regnet ud
    $('#pause-overlay').hidden = !p;
    $('#btn-pause-end').hidden = !game.flight;
    $('#btn-pause-menu').hidden = !!game.flight;
    $('#btn-pause-shop').hidden = !!game.flight;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    if (!p && pendingSeg) { var s = pendingSeg; pendingSeg = null; resumeSeg(s); }
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  // Pause midt i en afspilning: resten af stykket vises fra bilens nuværende sted
  var pendingSeg = null;
  function resumeSeg(s) { playing = false; play(s); }
  $('#btn-pause').addEventListener('click', function () {
    if (phase === 'fly' && playing) { pendingSeg = remainingSeg(); playing = false; }
    setPaused(!paused);
  });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-pause-end').addEventListener('click', function () { sfx('click'); pendingSeg = null; skipToEnd(); });
  $('#btn-pause-menu').addEventListener('click', function () { sfx('click'); paused = false; hideOverlays(); show('menu'); });
  $('#btn-pause-shop').addEventListener('click', function () { sfx('click'); paused = false; hideOverlays(); show('shop'); });
  // Det, der mangler af det stykke, der blev afspillet
  function remainingSeg() {
    if (!curSeg || !lastCar) return curSeg;
    var fr = curSeg.frames.filter(function (f) { return f.t >= lastCar.t; });
    if (fr.length < 2) fr = curSeg.frames.slice(-2);
    return { frames: fr, event: curSeg.event };
  }

  // ---------- Tegning og status ----------
  var sceneCache = null;
  function scene() {
    var st = game.stats();
    sceneCache = {
      course: game.course, taken: game.flight ? game.flight.taken : {}, tNow: lastCar ? lastCar.t : 0,
      angle: game.p.angle, type: game.bilType(), vinger: st.vinger, raket: game.p.upg.raket > 0,
      trail: trail, previews: [], felter: [],
      udsyn: (game.st || st).udsyn,
      opg: game.p.upg, maxHp: (game.st || st).maxHp          // kun til tegningen (synlige opgraderinger og slid)
    };
    return sceneCache;
  }
  function renderCourse() {
    if (current !== 'game' || tegn.animating) return;
    var sc = scene();
    if (phase === 'launch') {
      var pv = game.launchPreview();
      var a = game.p.angle * Math.PI / 180;
      sc.car = { x: -1.6, y: L.RAMPE.h, vx: Math.cos(a), vy: Math.sin(a), ground: false };
      sc.preLaunch = true; sc.fit = true; sc.trail = null;
      // Kun starten af buen – ingen landing
      sc.previews = [{ pts: pv.pts, slags: 'start' }];
      sc.taken = {};
      sc.lim = sc.udsyn;
    } else if (phase === 'freeze' && opts) {
      var f = game.flight;
      sc.car = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, ground: f.ground, nose: f.nose, hp: f.hp };
      sc.tNow = f.t; sc.fit = true;
      sc.lim = f.x + sc.udsyn;
      // Hvert kort: den skønnede vej (inden for udsyn) og det usikre landingsfelt
      // (kort med samme felt deler ét felt og én tekst, fx "2 og 3: ca. 50–65 m")
      opts.kort.forEach(function (k, i) {
        sc.previews.push({ pts: k.felt.pts, slags: 'kort-' + (i + 1) });
        var same = sc.felter.filter(function (x) { return x.fra === k.felt.fra && x.til === k.felt.til; })[0];
        if (same) { same.tekst = same.tekst.replace(':', ' og ' + (i + 1) + ':'); return; }
        sc.felter.push({ fra: k.felt.fra, til: k.felt.til, nr: i + 1, tekst: (i + 1) + ': ' + feltTxt(k), raekke: sc.felter.length });
      });
    } else {
      sc.car = lastCar || { x: 0, y: L.RAMPE.h, vx: 1, vy: 0 };
      sc.tNow = sc.car.t;
      if (game.flight && phase !== 'done') sc.lim = sc.car.x + sc.udsyn; else sc.udsyn = undefined;
    }
    tegn.draw(sc);
  }
  function hud(c) {
    var st = game.st || game.stats();
    $('#hud-dist').textContent = m(Math.max(0, c ? c.x : 0));
    var hp = c ? Math.max(0, Math.round(100 * c.hp / st.maxHp)) : 100;
    $('#hud-hp').textContent = hp + ' %';
    $('.hud-hp').classList.toggle('low', hp <= 30);
    $('#hud-coins').textContent = c ? Math.floor(c.coins * L.multiplier(game.p.bil)) : 0;
    $('#hud-boost').textContent = c ? c.boosts : st.boosts;
  }
  function refresh() {
    controls.dataset.phase = phase === 'done' ? 'idle' : phase;
    var st = game.st || game.stats();
    var f = game.flight;
    // Opsendelse
    $('#ang-value').textContent = game.p.angle + '°';
    $('#pow-value').textContent = game.p.power;
    var mt = $('#pow-meter');
    if (mt.children.length !== 10) { var h = ''; for (var k = 1; k <= 10; k++) h += '<i style="--k:' + k + '"></i>'; mt.innerHTML = h; }
    $$('i', mt).forEach(function (el, k) { el.classList.toggle('on', k < game.p.power); });
    // Status
    if (phase === 'launch') hud(null);
    else if (f) hud(lastCar && phase === 'fly' ? lastCar : { x: f.x, hp: f.hp, coins: f.coins, boosts: f.boosts });
    else if (phase === 'done' && lastCar) hud(lastCar);
    // Beslutningspunkt
    if (phase === 'freeze' && f) {
      $('#freeze-label').textContent = 'Vælg et kort';
      $('#freeze-value').textContent = 'udsyn ' + Math.round(game.st.udsyn) + ' m';
    }
    renderCards();
    $('#fly-value').textContent = fastNow ? 'Hurtig' : 'Rolig';
    $('#btn-speed-label').textContent = fastNow ? 'Roligere' : 'Hurtigere';
    $('#btn-speed').setAttribute('aria-pressed', String(fastNow));
    $('#btn-speed svg use').setAttribute('href', '#rampen-ikon-' + (fastNow ? 'rolig' : 'hurtig'));
    // Knapper
    var on = current === 'game' && !paused && !overlayOpen();
    $$('#controls button').forEach(function (b) { b.disabled = !on; });
    if (on && phase === 'launch') {
      $('#controls [data-pow="-1"]').disabled = game.p.power <= 1;
      $('#controls [data-pow="1"]').disabled = game.p.power >= 10;
      $$('#controls [data-ang]').forEach(function (b) { var d = +b.dataset.ang; b.disabled = d < 0 ? game.p.angle <= L.ANGLE_MIN : game.p.angle >= L.ANGLE_MAX; });
    }
    if (on && phase === 'fly') $('#btn-skip').disabled = !playing;
    // Besked
    var txt = noteText, cls = noteCls, fuld = '';
    if (!txt) {
      if (phase === 'launch') txt = game.p.trips ? 'Tur ' + (game.p.trips + 1) + '. Vælg vinkel og kraft, og send bilen afsted.' : 'Vælg vinkel og kraft, og send bilen afsted.';
      else if (phase === 'fly') txt = 'Bilen kører …';
      else if (phase === 'freeze' && opts) {
        // Kort tekst på skærmen; hele forklaringen (altid som interval) læses op via banen
        txt = 'Vinden er skjult: felterne viser, hvor bilen cirka lander.';
        fuld = 'Bilen er på toppen ved ' + m(f.x) + '. Du kan se ' + Math.round(game.st.udsyn) + ' m frem. ' +
          opts.kort.map(kortAria).join(' ');
      } else if (phase === 'done') txt = 'Turen er slut.';
    }
    var hint = $('#hint');
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    courseEl.setAttribute('aria-label', 'Banen. ' + (fuld || txt));
    renderCourse();
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Værkstedet ----------
  function buildShop() {
    var grid = $('#upg-grid');
    if (grid.children.length) return;
    L.OPG.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'btn upg-btn'; b.dataset.upg = o.id;
      b.innerHTML = '<svg aria-hidden="true"><use href="#rampen-ikon-' + o.id + '"/></svg>' +
        '<span class="upg-name"></span><span class="upg-lvl" aria-hidden="true"></span><span class="upg-desc"></span><span class="upg-price"></span>';
      b.querySelector('.upg-name').textContent = o.navn;
      b.querySelector('.upg-desc').textContent = o.tekst;
      var lv = ''; for (var i = 0; i < o.max; i++) lv += '<i></i>';
      b.querySelector('.upg-lvl').innerHTML = lv;
      onAct(b, function () { buy(o.id); });
      grid.appendChild(b);
    });
  }
  function buy(id) {
    var o = L.OPG.filter(function (x) { return x.id === id; })[0];
    var before = game.bilType();
    if (!game.buy(id)) {
      sfx('blocked');
      var pr = game.price(id);
      shopNote(pr === null ? o.navn + ' er allerede på højeste niveau.' : 'Du mangler ' + coinsText(pr - game.p.coins) + ' til ' + o.navn.toLowerCase() + '.');
      return;
    }
    sfx('buy'); saveProgress();
    var after = game.bilType();
    shopNote(after !== before ? 'Bilen er bygget om til en ' + BILNAVN[after] + '!' : o.navn + ' er nu niveau ' + game.p.upg[id] + '.');
    syncShop();
  }
  var shopMsg = '';
  function shopNote(t) { shopMsg = t; $('#shop-car').textContent = t; clearTimeout(shopNote.t); shopNote.t = setTimeout(function () { shopMsg = ''; syncShopHead(); }, 3500); }
  function syncShopHead() {
    $('#shop-car').textContent = shopMsg || carName();
    $('#shop-best').textContent = m(game.p.best);
    $('#shop-coins').textContent = game.p.coins;
  }
  function syncShop() {
    buildShop();
    syncShopHead();
    $$('#upg-grid .upg-btn').forEach(function (b) {
      var id = b.dataset.upg, o = L.OPG.filter(function (x) { return x.id === id; })[0], lvl = game.p.upg[id], pr = game.price(id);
      $$('.upg-lvl i', b).forEach(function (el, k) { el.classList.toggle('on', k < lvl); });
      b.querySelector('.upg-price').textContent = pr === null ? 'Fuldt udbygget' : pr + ' mønter';
      b.classList.toggle('max', pr === null);
      b.classList.toggle('dyr', pr !== null && pr > game.p.coins);
      b.setAttribute('aria-label', o.navn + ', niveau ' + lvl + ' af ' + o.max + '. ' + o.tekst + '. ' + (pr === null ? 'Fuldt udbygget.' : 'Pris ' + pr + ' mønter.'));
    });
    var gl = $('#goals');
    gl.innerHTML = '<div class="goals-label">Mål</div>';
    game.goals().forEach(function (g) {
      var d = document.createElement('div'); d.className = 'goal';
      d.textContent = g.tekst + ' ';
      var b = document.createElement('b'); b.textContent = '+' + g.beloen; d.appendChild(b);
      gl.appendChild(d);
    });
    var nc = game.canNewCar();
    $('#btn-newcar').disabled = !nc;
    $('#newcar-sub').textContent = nc ? '+' + Math.round(L.multiplier(game.p.bil + 1) * 100 - 100) + ' % mønter' : 'fra ' + L.NY_BIL_KRAV + ' m';
    if (current === 'shop') { fitScreen($('#shop')); drawCars(); }
  }
  $('#btn-shop-go').addEventListener('click', function () { sfx('click'); startTrip(); });
  $('#btn-shop-menu').addEventListener('click', function () { sfx('click'); show('menu'); });

  // ---------- Ny bil (prestige) ----------
  function askNewCar() {
    if (!game.canNewCar()) return;
    $('#newcar-text').textContent = 'Bil ' + game.p.bil + ' har kørt ' + m(game.p.carScore) + ' i alt. Den kommer på listen over biler. Den nye bil starter forfra som sæbekassebil på en ny bane, men giver ' +
      Math.round((L.multiplier(game.p.bil + 1) - 1) * 100) + ' % flere mønter på alle ture.';
    var ov = $('#newcar-overlay');
    ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
    $('#btn-newcar-no').focus({ preventScroll: true });
  }
  function closeNewCar() { $('#newcar-overlay').hidden = true; releaseGuard(); dwell.reset(); }
  function newCarOpen() { return !$('#newcar-overlay').hidden; }
  $('#btn-newcar').addEventListener('click', function () { sfx('click'); askNewCar(); });
  $('#btn-newcar-no').addEventListener('click', function () { sfx('click'); closeNewCar(); });
  $('#btn-newcar-yes').addEventListener('click', function () {
    var r = game.newCar();
    closeNewCar();
    if (!r) return;
    records.add('biler', r.score, { bil: r.bil });
    sfx('record'); saveProgress(); lastCar = null; trail = [];
    shopNote('Ny bil! Bil ' + game.p.bil + ' er klar på en ny bane.');
    syncShop();
  });

  // ---------- Rekorder ----------
  var recCat = 'tur';
  function openRecords() { syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.rec === recCat)); });
    $('#rec-title').textContent = recCat === 'tur' ? 'Længste ture' : 'Biler · samlet afstand';
    $('#rec-note').textContent = recCat === 'tur' ? 'Hver tur tæller for sig.' : 'En bil kommer på listen, når du bytter den til en ny bil (fra ' + L.NY_BIL_KRAV + ' m).';
    var ol = $('#rec-list'), list = records.list(recCat);
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li'), e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(m(e.score)));
        var lv = document.createElement('span'); lv.className = 'plates'; lv.textContent = ' · bil ' + (e.bil || 1);
        sc.appendChild(lv);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
      } else li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      ol.appendChild(li);
    }
  }
  $$('#records [data-rec]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recCat = b.dataset.rec; syncRecords(); fitScreen($('#records')); });
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
      var cur = arkade.get(b.dataset.set), val = b.dataset.value;
      b.setAttribute('aria-pressed', String(typeof cur === 'boolean' ? String(cur) === val : cur === val));
    });
    $$('#settings [data-gset]').forEach(function (b) { b.setAttribute('aria-pressed', String(String(gset.get(b.dataset.gset)) === b.dataset.value)); });
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
      var val = b.dataset.value;
      arkade.set(b.dataset.set, (val === 'true' || val === 'false') ? val === 'true' : val);
      sfx('click'); syncSettingsUi();
    });
  });
  $$('#settings [data-gset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.value;
      gset.set(b.dataset.gset, (v === 'true' || v === 'false') ? v === 'true' : v);
      if (b.dataset.gset === 'fart') fastNow = v === 'hurtig';
      sfx('click'); syncSettingsUi();
    });
  });
  function stepDwell(delta) {
    var v = Math.min(3, Math.max(0.5, Math.round((arkade.get('dwellTime') + delta) * 100) / 100));
    arkade.set('dwellTime', v); sfx('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('click');
    if (settingsReturn === 'game' && phase !== 'done') { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Opsendelse: pil op/ned = vinkel (Skift: 5°), pil venstre/højre = kraft, Enter/mellemrum = send.
  // Beslutning: 1/2/3 = valgkort nr., J = boost-kortet, V eller N = "Gem boostet"/"Glid videre" (hvis det er et kort).
  // Kørsel: H = hurtigere/roligere, Enter/mellemrum = spring frem. Esc eller P = pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current === 'shop' && newCarOpen()) { if (e.key === 'Escape') { e.preventDefault(); closeNewCar(); } return; }
    if (current !== 'game') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (phase === 'done') return;
      e.preventDefault();
      if (!paused && phase === 'fly' && playing) { pendingSeg = remainingSeg(); playing = false; }
      setPaused(!paused); return;
    }
    if (overlayOpen()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, handled = true;
    if (phase === 'launch') {
      if (k === 'ArrowUp') changeAngle(e.shiftKey ? 5 : 1);
      else if (k === 'ArrowDown') changeAngle(e.shiftKey ? -5 : -1);
      else if (k === 'ArrowRight') changePower(1);
      else if (k === 'ArrowLeft') changePower(-1);
      else if (k === 'Enter' || k === ' ') { if (!e.repeat) launch(); }
      else handled = false;
    } else if (phase === 'freeze') {
      if (k === '1' || k === '2' || k === '3') { if (!e.repeat) decideNr(+k - 1); }
      else if (k === 'j') { if (!e.repeat) decide(true); }
      else if (k === 'v' || k === 'n') { if (!e.repeat) decide(false); }
      else handled = false;
    } else if (phase === 'fly') {
      if (k === 'h') toggleFast();
      else if (k === 'Enter' || k === ' ') { if (!e.repeat) skipAhead(); }
      else handled = false;
    } else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver den største bane (banen har ingen fast form).
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(24, mn * 0.02)) }; }
  function candidates(b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10, head = small ? 34 : 40, hint = small ? 48 : 60;
    var res = { p: p, g: g, ig: ig, head: head, hint: hint, hintBoard: {} };
    // wide: panel med 2 kolonner til højre
    var hudW = Math.max(52, Math.min(66, b * 0.55));
    var panel2 = 2 * b + ig;
    var colWide = 2 * hudW + ig + ig + hint + ig + 2 * head + 4 * b + 5 * ig;
    res.wideW = panel2; res.hudWide = hudW;
    res.wide = colWide <= H - 2 * p ? { w: W - 2 * p - g - panel2, h: H - 2 * p } : null;
    // side/below: panel med 4 kolonner
    var panel4 = 4 * b + 3 * ig, hudC = small ? 46 : 52;
    var col4 = hudC + ig + hint + ig + head + 2 * b + 2 * ig;
    res.p4W = panel4; res.hudC = hudC;
    var colSide = col4;
    if (colSide > H - 2 * p) { res.hintBoard.side = true; colSide = col4 - hint - ig; }
    res.side = colSide <= H - 2 * p ? { w: W - 2 * p - g - panel4, h: H - 2 * p } : null;
    var colBelow = col4;
    res.below = panel4 <= W - 2 * p ? { w: W - 2 * p, h: H - 2 * p - colBelow - g } : null;
    if (res.below && res.below.h < 260) { res.hintBoard.below = true; res.below.h += hint + ig; }
    LAYOUTS.forEach(function (l) { var f = res[l]; if (f && (f.w < 220 || f.h < 160)) res[l] = null; });
    return res;
  }
  // Banen skal helst være bred: et mål for, hvor godt et layout er
  function score(f) { return f ? Math.min(f.w, f.h * 1.9) * Math.min(f.h, f.w * 0.9) : 0; }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || score(res[l]) > score(res[best]) * 1.04) best = l; });
    if (res.wide && score(res.wide) >= score(res[best]) * 0.9) best = 'wide';
    return res[best] ? best : null;
  }
  function bestFit(v) {
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 20; k++) {
      var res = candidates(b, v.W, v.H, small), lay = pick(res);
      all.push({ b: b, res: res, lay: lay, s: lay ? score(res[lay]) : 0 });
      if (lay && score(res[lay]) >= 0.45 * v.W * v.H * 0.6) break;
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    var max = 0;
    all.forEach(function (o) { if (o.s > max) max = o.s; });
    for (var i = 0; i < all.length; i++) if (all[i].lay && all[i].s >= max / 1.1) return all[i];
    return all[all.length - 1];
  }
  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, f, res) {
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    gridEl.classList.toggle('ctl4', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ig', res.ig + 'px');
    st.setProperty('--head-h', res.head + 'px');
    st.setProperty('--hint-h', res.hint + 'px');
    st.setProperty('--hud-h', Math.round(lay === 'wide' ? res.hudWide : res.hudC) + 'px');
    st.setProperty('--hud-cols', lay === 'wide' ? 2 : 4);
    st.setProperty('--board-w', Math.floor(f.w) + 'px');
    st.setProperty('--board-h', Math.floor(f.h) + 'px');
    st.setProperty('--panel-w', Math.floor(lay === 'wide' ? res.wideW : lay === 'below' ? f.w : res.p4W) + 'px');
    gameEl.dataset.layout = lay;
    var hb = !!res.hintBoard[lay], hintEl = $('#hint');
    if (hb && hintEl.parentNode !== $('#board-wrap')) $('#board-wrap').appendChild(hintEl);
    if (!hb && hintEl.parentNode !== $('#side')) $('#side').insertBefore(hintEl, controls);
    gameEl.dataset.board = Math.floor(f.w) + 'x' + Math.floor(f.h);
    tegn.resize(Math.floor(f.w), Math.floor(f.h));
  }
  function layoutGame() {
    if (current !== 'game') return;
    var v = viewport(), small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var best = bestFit(v), b = best.b, lay = best.lay, res = best.res;
    if (!lay) { res = candidates(floor, v.W, v.H, small); lay = pick(res) || 'below'; b = floor; if (!res[lay]) res[lay] = { w: v.W / 2, h: v.H / 3 }; }
    var f = { w: res[lay].w, h: res[lay].h };
    applyLayout(lay, b, f, res);
    for (var t = 0; t < 30 && (overflows(gameEl) || overflows(root)) && f.h > 60; t++) {
      f = { w: f.w * (lay === 'below' ? 1 : 0.97), h: f.h * 0.96 };
      applyLayout(lay, b, f, res);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    if (tegn.animating && lastCar) { /* næste billede tegnes med den nye størrelse */ } else renderCourse();
  }

  // ---------- Små skærme ----------
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('rampen-lille', small);
    root.classList.toggle('rampen-tvaers', small && v.W > v.H);
    // 9 opgraderinger: 5 + 4 på tværs, 3 × 3 på højkant
    $('#shop').style.setProperty('--upg-cols', v.W > v.H ? 5 : 3);
  }

  // Sider: blokkene (data-trin) fordeles på så få sider, som der er plads til.
  function makePager(screen, o) {
    var nav = document.createElement('div');
    nav.className = 'trin-nav'; nav.hidden = true;
    nav.innerHTML = '<button class="btn trin-prev" aria-label="Forrige side"><span class="icon" aria-hidden="true">‹</span><span class="big">Forrige</span></button>' +
      '<span class="trin-label" aria-live="polite"></span>' +
      '<button class="btn trin-next" aria-label="Næste side"><span class="icon" aria-hidden="true">›</span><span class="big">Næste</span></button>';
    o.navIn.appendChild(nav);
    function placeNav() {
      var host = (o.navBottom && !root.classList.contains('rampen-tvaers')) ? o.navBottom : o.navIn;
      if (nav.parentNode !== host) host.appendChild(nav);
      if (o.navBottom) o.navBottom.hidden = host !== o.navBottom || nav.hidden;
    }
    var prev = nav.querySelector('.trin-prev'), next = nav.querySelector('.trin-next'), label = nav.querySelector('.trin-label');
    var pages = [], idx = 0;
    function setHidden(el, h) { el.classList.toggle('trin-skjult', h); }
    function showPage(i, moveFocus) {
      idx = Math.max(0, Math.min(pages.length - 1, i));
      pages.forEach(function (pg, k) { pg.forEach(function (el) { setHidden(el, k !== idx); }); });
      label.textContent = 'Side ' + (idx + 1) + ' af ' + pages.length;
      prev.disabled = idx === 0; next.disabled = idx === pages.length - 1;
      if (moveFocus) {
        var a = document.activeElement;
        if (a === prev && prev.disabled) next.focus({ preventScroll: true });
        else if (a === next && next.disabled) prev.focus({ preventScroll: true });
      }
    }
    prev.addEventListener('click', function () { sfx('click'); showPage(idx - 1, true); });
    next.addEventListener('click', function () { sfx('click'); showPage(idx + 1, true); });
    return {
      reset: function () { o.all().forEach(function (el) { setHidden(el, false); }); nav.hidden = true; pages = []; placeNav(); },
      paginate: function (keep) {
        var blocks = o.blocks(), was = keep ? idx : 0;
        nav.hidden = false; placeNav();
        label.textContent = 'Side 1 af 2';
        blocks.forEach(function (el) { setHidden(el, true); });
        pages = []; var cur = [];
        blocks.forEach(function (el) {
          setHidden(el, false);
          if (cur.length && overflows(screen)) {
            setHidden(el, true); cur.forEach(function (c) { setHidden(c, true); });
            pages.push(cur); cur = [el]; setHidden(el, false);
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
      navIn: $('#settings .tabs'), navBottom: $('#settings .trin-bund'),
      all: function () { return $$('#settings .tab-panel > *'); },
      blocks: function () { return $$('#settings .tab-panel:not([hidden]) > *'); }
    }),
    om: makePager($('#om'), {
      navIn: $('#om .om-back-row'),
      all: function () { return $$('#om [data-trin]'); },
      blocks: function () { return $$('#om [data-trin]'); }
    })
  };

  // De andre skærme (og boksene) tilpasses vinduet, til alt kan ses:
  // 1) mindre knapper og afstande (på små skærme aldrig under SMALL_MIN),
  // 2) valgfri tekst skjules, 3) indholdet deles på flere sider, 4) zoom som nødløsning.
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
    var base = isOverlay ? (parseFloat(getComputedStyle(el).getPropertyValue('--btn')) || cssBtn(v.W, v.H)) : cssBtn(v.W, v.H);
    var minB = small ? SMALL_MIN : 84;
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('rampen-tvaers')) {
        var h = $('#btn-hall').getBoundingClientRect(), t = $('.title-block').getBoundingClientRect();
        if (!el.classList.contains('hall-inflow') && h.right > t.left && h.bottom > t.top && h.left < t.right && h.top < t.bottom) {
          el.classList.add('hall-inflow'); return false;
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
    $$('#' + current + ' .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    drawCars();
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    syncSmall(); fitCurrent();
    clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCurrent, 150);
  });

  // Gem, når siden lukkes. En tur, der er i gang, gemmes ved det seneste valg og kan
  // fortsætte næste gang; en tur, der allerede er slut, gøres færdig (mønter og rekord).
  window.addEventListener('pagehide', function () {
    if (game.flight && game.flight.done) { var r = game.finishTrip(); if (r) records.add('tur', r.dist, { bil: game.p.bil }); }
    saveProgress();
  });

  // ---------- Start ----------
  RampenTegn.installerIkoner();
  syncSmall();
  applyGlow();
  applyFog();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Rampen = {
    get game() { return game; }, get phase() { return phase; }, get playing() { return playing; }, get paused() { return paused; },
    get guard() { return gazeGuard ? gazeGuard.id : null; }, get tegn() { return tegn; }, get options() { return opts; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    start: startTrip, show: show, launch: launch, angle: changeAngle, power: changePower, decide: decide, decideNr: decideNr,
    get cards() { return opts ? opts.kort : []; }, get udsyn() { return game.st ? game.st.udsyn : game.stats().udsyn; },
    skip: skipAhead, skipToEnd: skipToEnd, buy: buy, setPaused: setPaused, layout: layoutGame, refresh: refresh,
    // Til test: giv mønter / læg et fremskridt ind
    setProgress: function (p) { game = L.createGame(p); saveProgress(); syncMenu(); },
    save: saveProgress
  };
})();
