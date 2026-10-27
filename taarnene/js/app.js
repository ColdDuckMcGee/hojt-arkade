/*
 * Tårnene – brugerflade: skærme, input, indstillinger, lyd, bølgernes afvikling og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Rørlægger og Pixelgåder.
 *
 * Byggefase: vælg et felt (klik, tryk, dwell eller Enter) → et stort panel med
 * tårnene. Vælg et tårn, du har, for at opgradere eller sælge det. Der er ingen tid.
 * Start bølgen: bølgen kører roligt af sig selv (eller trin for trin), og spilleren
 * skal ikke reagere på noget. Bølger uden ende – spillet slutter, når livene er brugt.
 *
 * Logikken ligger i js/logik.js (ingen farver), tegningen i js/tegn.js (læser kun
 * tilstanden), og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.TaarneneLogik;
  var TG = window.TaarneneTegn;
  var CAT = 'uendelig';   // én rekordliste

  // ---------- Tekster (ens for alle temaer) ----------
  var NAVN = { laser: 'Laser', puls: 'Puls', frost: 'Frost', kanon: 'Kanon' };
  var BESKRIV = {
    laser: 'Skyder på den forreste fjende. Billig og god.',
    puls: 'Rammer alle fjender tæt på, på én gang.',
    frost: 'Gør alle fjender tæt på langsommere.',
    kanon: 'Tungt skud langt væk, hvert andet trin.'
  };
  var FJENDE = {
    kugle: ['kugle', 'kugler', 'Kugle', 'Almindelig fjende.'],
    pil: ['pil', 'pile', 'Pil', 'Hurtig, men svag.'],
    kasse: ['kasse', 'kasser', 'Kasse', 'Langsom og stærk.'],
    kaempe: ['kæmpe', 'kæmper', 'Kæmpe', 'Hver 5. bølge. Koster 3 liv.']
  };

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // gloed: temaets glød (kan slås fra; spillet kan aflæses uden).
  // visning: 'auto' (bølgen kører af sig selv) eller 'trin' (ét trin pr. tryk).
  // hurtig: hurtigere visning af bølgen.
  var tset = ArkadeSettings.create('taarnene', { gloed: true, visning: 'auto', hurtig: false });
  var records = ArkadeHighscores.create('taarnene', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (['auto', 'trin'].indexOf(tset.get('visning')) < 0) tset.set('visning', 'auto');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell = én handling: samme knap (felt, Næste trin) kan først dwelles igen,
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
  // Dwell-sikker dialog: en knap, der dukker op præcis under blikket, kan først
  // vælges, når blikket har forladt den én gang.
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
  var SFX = {
    build: 'bonusSpawn', upgrade: 'bonus', sell: 'bonusGone', kill: 'eat', leak: 'obstacle',
    wave: 'move', waveDone: 'bonus', lost: 'crash', record: 'record', click: 'click', pause: 'pause', blocked: 'click'
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
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    $('#game').classList.toggle('calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse. Bølgen vises trin for trin uden glidende bevægelse'
      : 'Bevægelse i baggrunden, og fjender, der glider roligt. Fra giver faste skift';
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
  function applyGlow() { root.setAttribute('data-tt-gloed', tset.get('gloed') ? 'til' : 'fra'); }
  tset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    syncSettingsUi();
    if (game) refresh();
  });

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu', helpReturn = 'menu';
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
  function wavesText(n) { return n === 1 ? '1 bølge' : n + ' bølger'; }
  function livesText(n) { return n === 1 ? '1 liv' : n + ' liv'; }
  function moneyText(n) { return n === 1 ? '1 penge' : n + ' penge'; }
  function num(x) { return String(x).replace('.', ','); }
  function cmText(px) { return (px / (96 / 2.54)).toFixed(1).replace('.', ','); }
  function listText(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1]; }
  function waveText(spec) {
    var c = L.countTypes(spec.types), parts = [];
    ['kugle', 'pil', 'kasse', 'kaempe'].forEach(function (t) { if (c[t]) parts.push(c[t] + ' ' + FJENDE[t][c[t] === 1 ? 0 : 1]); });
    return listText(parts);
  }

  // ---------- Banen, skærmen kan bære ----------
  // Felterne er knapper og skal være store nok til øjenstyring: helst 100 px
  // (ca. 2,6 cm) eller mere, mindst 80 px. Den største bane, der kan det, vælges.
  var MIN_CELL = 80, GOOD_CELL = 100;
  function chooseMap() {
    var v = viewport(), list = L.allMaps().map(function (m) { return { m: m, c: bestFit(m, v).cell }; });
    function best(min) {
      var ok = list.filter(function (o) { return o.c >= min; });
      ok.sort(function (a, b) { return (b.m.w * b.m.h - a.m.w * a.m.h) || (b.c - a.c); });
      return ok[0] || null;
    }
    var o = best(GOOD_CELL) || best(MIN_CELL);
    if (!o) { list.sort(function (a, b) { return b.c - a.c; }); o = list[0]; }
    return o.m;
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var m = chooseMap(), c = bestFit(m, viewport()).cell, notes = [];
    $('#start-sub').textContent = 'Bølger uden ende · bane ' + m.w + ' × ' + m.h;
    if (c < MIN_CELL) notes.push('På denne skærm bliver felterne ca. ' + cmText(c) + ' cm.' + (isFullscreen() ? '' : ' Fuld skærm giver lidt større felter.'));
    $('#size-note').textContent = notes.join(' ');
    $('#menu-demo').innerHTML = TG.miniBane(L.MAPS[0], DEMO_TOWERS);
    if (current === 'menu') fitScreen($('#menu'));
  }
  var DEMO_TOWERS = { 10: { type: 'laser', level: 1 }, 20: { type: 'puls', level: 1 }, 29: { type: 'frost', level: 1 }, 36: { type: 'kanon', level: 1 } };
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  $('#btn-hjaelp').addEventListener('click', function () { sfx('click'); openHelp('menu'); });
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, tset].forEach(function (s) {
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

  // ---------- Hjælp ----------
  function buildHelp() {
    var range = function (t) { return num(L.towerStats(t, 1).range); };
    $('#hj-taarne').innerHTML = L.TOWER_TYPES.map(function (t) {
      return '<div class="hj-item">' + TG.taarnSvg(t, 1) + '<div><b>' + NAVN[t] + ' · ' + L.TOWERS[t].cost + ' penge</b><span>' + BESKRIV[t] + ' Rækkevidde ' + range(t) + ' felt.</span></div></div>';
    }).join('');
    $('#hj-fjender').innerHTML = ['kugle', 'pil', 'kasse', 'kaempe'].map(function (t) {
      return '<div class="hj-item">' + TG.fjendeSvg(t) + '<div><b>' + FJENDE[t][2] + '</b><span>' + FJENDE[t][3] + '</span></div></div>';
    }).join('');
  }
  function openHelp(from) { helpReturn = from; show('hjaelp'); }
  $('#btn-hj-back').addEventListener('click', function () {
    sfx('click');
    if (helpReturn === 'game' && game && !finished) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

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
  var game = null, paused = false, finished = false;
  var curIdx = -1, selIdx = -1;
  var boardEl = $('#board');
  var lastNote = '', noteCls = '';
  var tegn = TG.create(boardEl);
  // Bølgens afvikling
  var anim = { on: false, before: null, ev: null, t0: 0, dur: 0, raf: 0, timer: 0 };
  var restAuto = false;            // "Vis resten" i trin for trin
  var TICK = 900, TICK_FAST = 380, GAP = 120;

  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    if (!c || swallowed(c)) return;
    chooseCell(+c.dataset.i);
  });

  function startGame() {
    stopAnim();
    game = L.createGame({ map: chooseMap() });
    paused = false; finished = false; restAuto = false;
    curIdx = -1; selIdx = -1; lastNote = ''; noteCls = '';
    tegn.build(game.state.map);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#byg-overlay', '#taarn-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function building() { return game && game.state.phase === 'bygge'; }
  function waving() { return game && game.state.phase === 'boelge'; }
  function live() { return game && !paused && !finished && current === 'game' && !overlayOpen(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }
  function autoMode() { return tset.get('visning') === 'auto' || restAuto; }
  function still() { return !animationOn(); }

  // ---------- Vælg et felt → panelet ----------
  function chooseCell(i) {
    if (!live()) return;
    if (curIdx >= 0) curIdx = i;
    if (game.isPath(i)) { sfx('blocked'); setNote('Her er stien. Byg ved siden af.', ''); refresh(); return; }
    if (!building()) { setNote('Byg igen, når bølgen er slut.', ''); refresh(); return; }
    selIdx = i;
    sfx('click');
    if (game.state.towers[i]) openTower(i); else openBuild(i);
  }
  function cellName(i) { var w = game.state.map.w; return 'række ' + (Math.floor(i / w) + 1) + ', kolonne ' + (i % w + 1); }
  function bygCols() { var v = viewport(); return v.W / v.H > 1.55 ? 4 : 2; }
  function openBuild(i) {
    var s = game.state;
    $('#byg-title').textContent = 'Byg et tårn';
    $('#byg-sub').textContent = 'Felt på ' + cellName(i) + ' · du har ' + moneyText(s.money);
    var box = $('#byg-valg');
    $('#byg-overlay').style.setProperty('--byg-cols', bygCols());
    box.innerHTML = L.TOWER_TYPES.map(function (t) {
      var cost = L.TOWERS[t].cost, ok = s.money >= cost;
      return '<button class="btn taarn-valg" data-type="' + t + '"' + (ok ? '' : ' aria-disabled="true"') + '>' +
        '<span class="tv-pic">' + TG.taarnSvg(t, 1) + '</span>' +
        '<span class="big">' + NAVN[t] + '</span>' +
        '<span class="tv-pris">' + (ok ? moneyText(cost) : moneyText(cost) + ' – mangler ' + (cost - s.money)) + '</span>' +
        '<span class="tv-tekst">' + BESKRIV[t] + '</span></button>';
    }).join('');
    $$('.taarn-valg', box).forEach(function (b) {
      b.addEventListener('click', function () { doBuild(b.dataset.type); });
    });
    openOverlay('#byg-overlay');
    tegn.range(i, null);
    renderBoard();
    var first = $('.taarn-valg:not([aria-disabled="true"])', box) || $('#btn-byg-luk');
    first.focus({ preventScroll: true });
  }
  function doBuild(type) {
    if (selIdx < 0 || !game) return;
    var res = game.build(selIdx, type);
    if (!res.ok) {
      sfx('blocked');
      if (res.why === 'penge') $('#byg-sub').textContent = 'Du mangler ' + moneyText(res.mangler) + ' til ' + NAVN[type] + '. Vælg et andet tårn, eller tryk Fortryd.';
      return;
    }
    sfx('build');
    setNote(NAVN[type] + ' bygget for ' + moneyText(res.cost) + '.', 'ok');
    closePanels();
  }
  function openTower(i) {
    var s = game.state, t = s.towers[i], st = L.towerStats(t.type, t.level);
    $('#taarn-pic').innerHTML = TG.taarnSvg(t.type, t.level);
    $('#taarn-title').textContent = NAVN[t.type] + ' · niveau ' + t.level + ' af ' + L.MAX_LEVEL;
    var info = statsText(t.type, t.level);
    var up = L.upgradeCost(t.type, t.level), btnUp = $('#btn-opgrader');
    if (t.level < L.MAX_LEVEL) {
      info += ' Næste niveau: ' + statsText(t.type, t.level + 1).toLowerCase();
      $('#opgrader-sub').textContent = s.money >= up ? moneyText(up) : moneyText(up) + ' – mangler ' + (up - s.money);
      if (s.money >= up) btnUp.removeAttribute('aria-disabled'); else btnUp.setAttribute('aria-disabled', 'true');
    } else {
      $('#opgrader-sub').textContent = 'højeste niveau';
      btnUp.setAttribute('aria-disabled', 'true');
    }
    $('#taarn-info').textContent = info + ' Du har ' + moneyText(s.money) + '.';
    var sv = game.sellValue(i);
    $('#saelg-sub').textContent = '+' + moneyText(sv) + (t.fresh === t.invested ? ' (alt tilbage)' : '');
    openOverlay('#taarn-overlay');
    tegn.range(i, st.range);
    renderBoard();
    (btnUp.getAttribute('aria-disabled') ? $('#btn-taarn-luk') : btnUp).focus({ preventScroll: true });
  }
  function statsText(type, level) {
    var st = L.towerStats(type, level), parts = [];
    if (L.TOWERS[type].slow) parts.push('Sænker til ' + Math.round(st.factor * 100) + ' % fart');
    if (st.dmg) parts.push((parts.length ? 'skade ' : 'Skade ') + st.dmg + (L.TOWERS[type].area ? ' på alle' : ''));
    parts.push('rækkevidde ' + num(st.range) + ' felt');
    if (st.cd > 1) parts.push('hvert ' + st.cd + '. trin');
    return parts.join(', ') + '.';
  }
  function openOverlay(sel) {
    var ov = $(sel);
    ov.hidden = false;
    fitScreen(ov);
    dwell.reset();
    guardUnderGaze(ov);
  }
  function closePanels() {
    $('#byg-overlay').hidden = true; $('#taarn-overlay').hidden = true;
    releaseGuard(); dwell.reset();
    selIdx = -1; tegn.range(null);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-byg-luk').addEventListener('click', function () { sfx('click'); closePanels(); });
  $('#btn-taarn-luk').addEventListener('click', function () { sfx('click'); closePanels(); });
  $('#btn-opgrader').addEventListener('click', function () {
    if (selIdx < 0 || !game) return;
    var t = game.state.towers[selIdx], res = game.upgrade(selIdx);
    if (!res.ok) { sfx('blocked'); return; }
    sfx('upgrade');
    setNote(NAVN[t.type] + ' er nu niveau ' + res.level + '.', 'ok');
    closePanels();
  });
  $('#btn-saelg').addEventListener('click', function () {
    if (selIdx < 0 || !game) return;
    var t = game.state.towers[selIdx], res = game.sell(selIdx);
    if (!res.ok) return;
    sfx('sell');
    setNote(NAVN[t.type] + ' solgt for ' + moneyText(res.value) + '.', '');
    closePanels();
  });

  // ---------- Bølgen ----------
  function waveButton() {
    if (!live()) return;
    if (building()) { startWave(); return; }
    if (waving() && !autoMode() && !anim.on) playStep();
  }
  function speedButton() {
    if (!game || finished) return;
    if (waving() && !autoMode()) {
      // Trin for trin: "Vis resten" kører resten af bølgen af sig selv
      restAuto = true; sfx('click');
      if (!anim.on && !paused) playStep();
      refresh();
      return;
    }
    tset.set('hurtig', !tset.get('hurtig'));
    sfx('click');
    refresh();
  }
  $('#btn-wave').classList.add('turn-btn');
  $('#btn-wave').addEventListener('click', function () { if (!swallowed(this)) waveButton(); });
  $('#btn-speed').classList.add('turn-btn');
  $('#btn-speed').addEventListener('click', function () { if (!swallowed(this)) speedButton(); });

  function startWave() {
    var res = game.startWave();
    if (!res.ok) return;
    sfx('wave');
    restAuto = false;
    curIdx = -1;
    boardEl.classList.add('boelge');
    setNote('Bølge ' + game.state.wave + ': ' + waveText(res.spec) + '.', '');
    refresh();
    if (autoMode()) anim.timer = setTimeout(playStep, GAP);
  }
  function snapshot() {
    var o = {};
    game.state.enemies.forEach(function (e) { o[e.id] = { p: e.p, hp: e.hp, maxHp: e.maxHp, type: e.type }; });
    return o;
  }
  function playStep() {
    clearTimeout(anim.timer);
    if (!game || !waving() || anim.on) return;
    anim.before = snapshot();
    var ev = game.step();
    anim.ev = ev;
    anim.on = true;
    anim.t0 = performance.now();
    anim.dur = tset.get('hurtig') ? TICK_FAST : TICK;
    if (ev.killed.length) sfx('kill');
    if (ev.leaked.length) sfx('leak');
    if (ev.leaked.length) {
      var lost = ev.leaked.reduce(function (a, k) { return a + k.lives; }, 0);
      setNote(lost === 1 ? 'En fjende slap igennem. Du mistede et liv.' : 'Fjender slap igennem. Du mistede ' + livesText(lost) + '.', 'err');
    }
    refresh();
    if (still()) {
      tegn.frame(game, anim.before, ev, 1, true);
      anim.timer = setTimeout(stepDone, anim.dur);
    } else {
      anim.raf = requestAnimationFrame(animate);
    }
  }
  function animate(now) {
    if (!anim.on) return;
    var f = Math.min(1, (now - anim.t0) / anim.dur);
    tegn.frame(game, anim.before, anim.ev, f, false);
    if (f < 1) anim.raf = requestAnimationFrame(animate); else stepDone();
  }
  function stopAnim() {
    anim.on = false; cancelAnimationFrame(anim.raf); clearTimeout(anim.timer);
  }
  function stepDone() {
    anim.on = false;
    if (!game || finished) return;
    var ev = anim.ev;
    if (ev.gameOver) {
      sfx('lost');
      setNote('Fjenderne kom igennem, og du har ikke flere liv.', 'err');
      refresh();
      anim.timer = setTimeout(function () { finish('lost'); }, 1400);
      return;
    }
    if (ev.waveDone) {
      sfx('waveDone');
      tegn.clearWave();
      boardEl.classList.remove('boelge');
      restAuto = false;
      setNote('Bølge ' + ev.bonus.wave + ' klaret! +' + moneyText(ev.bonus.money) + ' og +' + pointsText(ev.bonus.points) + '.', 'ok');
      refresh();
      return;
    }
    refresh();
    if (autoMode() && !paused) anim.timer = setTimeout(playStep, GAP);
  }

  // ---------- Tegning ----------
  function renderBoard() {
    if (!game) return;
    tegn.cells(game, { cursor: live() && building() ? curIdx : -1, selected: selIdx, names: NAVN });
  }
  function refresh() {
    if (!game) return;
    var s = game.state;
    $('#hud-wave').textContent = s.wave;
    $('#hud-score').textContent = s.score;
    $('#hud-money').textContent = s.money;
    $('#hud-lives').textContent = s.lives;
    $('.hud-liv').classList.toggle('lav', s.lives <= 3);
    $('#points-note').textContent = 'Point for hver fjende og ' + L.RULES.wavePoints(1) + ' × bølgens nummer for hver klaret bølge';
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (!txt) {
      if (building()) txt = 'Næste bølge: ' + waveText(L.waveSpec(s.wave, s.seed)) + '.';
      else if (waving()) txt = 'Bølgen kører af sig selv.';
    }
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    // Knapperne
    var wb = $('#btn-wave'), sb = $('#btn-speed');
    var useIco = $('#wave-ico'), spIco = $('#speed-ico');
    if (building()) {
      $('#wave-label').textContent = 'Start bølgen';
      $('#wave-sub').textContent = 'Bølge ' + s.wave + ' · ' + L.RULES.count(s.wave) + (s.wave % 5 === 0 ? ' + kæmper' : ' fjender');
      useIco.setAttribute('href', '#tt-ikon-boelge');
      wb.disabled = !live();
    } else if (waving() && !autoMode()) {
      $('#wave-label').textContent = 'Næste trin';
      $('#wave-sub').textContent = 'trin ' + s.tick;
      useIco.setAttribute('href', '#tt-ikon-trin');
      wb.disabled = !live();
    } else {
      $('#wave-label').textContent = 'Bølgen kører';
      $('#wave-sub').textContent = 'trin ' + s.tick;
      useIco.setAttribute('href', '#tt-ikon-boelge');
      wb.disabled = true;
    }
    if (waving() && !autoMode()) {
      $('#speed-label').textContent = 'Vis resten';
      $('#speed-sub').textContent = 'resten af bølgen af sig selv';
      spIco.setAttribute('href', '#tt-ikon-hurtig');
      sb.removeAttribute('aria-pressed');
    } else {
      $('#speed-label').textContent = 'Hurtigere visning';
      $('#speed-sub').textContent = tset.get('hurtig') ? 'bølgen vises hurtigere' : 'bølgen kører roligt';
      spIco.setAttribute('href', '#tt-ikon-hurtig');
      sb.setAttribute('aria-pressed', String(!!tset.get('hurtig')));
    }
    sb.disabled = finished || paused;
    boardEl.setAttribute('aria-label', 'Banen, ' + s.map.w + ' × ' + s.map.h + ' felter, bølge ' + s.wave);
    renderBoard();
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Pause ----------
  function setPaused(p) {
    if (!game || finished || game.state.phase === 'slut') return;
    if (p && overlayOpen() && !$('#pause-overlay').hidden) return;
    if (p) { $('#byg-overlay').hidden = true; $('#taarn-overlay').hidden = true; selIdx = -1; tegn.range(null); }
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
    // Fortsæt bølgen, hvis den stod og ventede
    if (!p && waving() && autoMode() && !anim.on) { clearTimeout(anim.timer); anim.timer = setTimeout(playStep, GAP); }
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-pause-hjaelp').addEventListener('click', function () { sfx('click'); openHelp('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit(); });

  // ---------- Bekræft Afslut ----------
  function askQuit() {
    if (!game || finished) return;
    $('#pause-overlay').hidden = true;
    var s = game.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' og ' + wavesText(s.cleared) + ' klaret. Pointene gemmes i rekorderne.';
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
    setPaused(false);
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { stopAnim(); game = null; paused = false; hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  var lastEntryId = null;
  function saveRecord() {
    var out = game.end(), res = null;
    finished = true;
    if (out.score > 0) res = records.add(CAT, out.score, { waves: out.cleared, kills: game.state.kills });
    return res;
  }
  function finish(why) {
    if (finished || !game) return;
    stopAnim();
    var s = game.state, wave = s.wave, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-title').textContent = 'Spillet er slut';
    $('#go-reason').textContent = why === 'lost'
      ? 'Fjenderne kom igennem i bølge ' + wave + ', og alle ' + L.RULES.lives + ' liv er brugt.'
      : 'Du afsluttede før bølge ' + wave + '.';
    $('#go-pic').innerHTML = TG.miniBane(s.map, s.towers);
    $('#go-pic').style.aspectRatio = s.map.w + ' / ' + s.map.h;
    $('#go-score').textContent = s.score;
    $('#go-waves').textContent = wavesText(s.cleared) + ' klaret · ' + s.kills + ' fjender nedkæmpet';
    $('#go-rank').textContent = rankText;
    renderRecordList($('#go-records'), CAT, lastEntryId);
    show('gameover');
  }
  window.addEventListener('pagehide', function () { if (game && !finished) saveRecord(); });
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
        lv.textContent = ' · ' + wavesText(typeof e.waves === 'number' ? e.waves : 0);
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
  function openRecords() { renderRecordList($('#rec-list'), CAT, null); show('records'); }
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
    $$('#settings [data-tset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(tset.get(b.dataset.tset)) === b.dataset.value));
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
  $$('#settings [data-tset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var val = b.dataset.value;
      tset.set(b.dataset.tset, (val === 'true' || val === 'false') ? val === 'true' : val);
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
    if (settingsReturn === 'game' && game && !finished) { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Piletasterne flytter markøren, Enter eller mellemrum vælger feltet, S starter
  // bølgen (eller tager næste trin), H skifter hurtigere visning, Esc eller P giver pause.
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  var hoverIdx = -1;
  boardEl.addEventListener('pointerover', function (e) { var c = e.target.closest('.cell'); hoverIdx = c ? +c.dataset.i : -1; });
  boardEl.addEventListener('pointerleave', function () { hoverIdx = -1; });
  function centre() { var m = game.state.map; return Math.floor(m.h / 2) * m.w + Math.floor(m.w / 2); }
  function moveCursor(d) {
    if (!live() || !building()) return;
    var m = game.state.map, i = curIdx;
    if (i < 0) i = hoverIdx >= 0 ? hoverIdx : centre();
    else {
      var x = Math.max(0, Math.min(m.w - 1, i % m.w + d[0])), y = Math.max(0, Math.min(m.h - 1, Math.floor(i / m.w) + d[1]));
      i = y * m.w + x;
    }
    curIdx = i; hoverIdx = -1;
    renderBoard();
  }
  function keySelect() {
    if (!live() || !building()) return;
    if (curIdx < 0) { curIdx = hoverIdx >= 0 ? hoverIdx : centre(); renderBoard(); return; }
    chooseCell(curIdx);
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; }
    if (!$('#byg-overlay').hidden || !$('#taarn-overlay').hidden) { if (e.key === 'Escape') { e.preventDefault(); closePanels(); } return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) keySelect(); }
    else if (k === 's') { if (!e.repeat) waveButton(); }
    else if (k === 'h') { if (!e.repeat) speedButton(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (overlayOpen()) return;   // panelet har lige fået fokus
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapper og felter er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver de største felter. Banen er cols × rows felter.
  var FRAME = 6;
  function readFrame() { FRAME = 2 * TG.cssNum('--tt-frame-w', 3); }
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  var MAX_CELL = 190, NBTN = 3; // Start bølgen, Hurtigere visning og Pause
  function candidates(m, b, W, H) {
    var cols = m.w, rows = m.h;
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10;
    var hudH = Math.max(52, Math.min(84, b * 0.62)), hint = 60, hintSide = 72;
    function cell(aw, ah) { return Math.min(MAX_CELL, Math.floor(Math.min((aw - FRAME) / cols, (ah - FRAME) / rows))); }
    var res = { p: p, g: g, hudH: hudH, ig: ig };
    var sideW = Math.min(380, Math.max(230, b * 2.2));
    var leftH = 100 + 4 * hudH + 3 * ig + 70 + b + 3 * ig;
    var rightH = hintSide + 2 * b + 2 * ig;
    res.sideW = sideW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? cell(W - 2 * p - 2 * sideW - 2 * g, H - 2 * p) : 0;
    res.side = 0;
    [1, 2, 3].forEach(function (k) {
      var panelW = Math.max(k * b + (k - 1) * ig, k === 1 ? 150 : 0);
      var hudCols = panelW >= 4 * 100 + 3 * ig ? 4 : (panelW >= 2 * 96 + ig ? 2 : 1), hudRows = 4 / hudCols;
      var rowsB = Math.ceil(NBTN / k);
      var panelH = hudRows * hudH + (hudRows - 1) * ig + g + hintSide + ig + rowsB * b + (rowsB - 1) * ig;
      if (panelH > H - 2 * p) return;
      var c = cell(W - 2 * p - g - panelW, H - 2 * p);
      if (c > res.side) { res.side = c; res.sideK = k; res.panelSide = panelW; res.hudColsSide = hudCols; }
    });
    res.below = 0;
    var needW = NBTN * b + (NBTN - 1) * ig;
    if (needW <= W - 2 * p) {
      var hudCols = W - 2 * p >= 4 * 96 + 3 * ig ? 4 : 2, hudRows = 4 / hudCols;
      var extra = hudRows * hudH + (hudRows - 1) * ig + g + hint + ig + b + g;
      res.below = cell(W - 2 * p, H - 2 * p - extra);
      res.belowK = NBTN; res.hudColsBelow = hudCols;
    }
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; });
    return res;
  }
  function pick(res, W, H) {
    // Stående skærm: knapperne under banen, når felterne stadig bliver store nok
    if (H > W && res.below >= MIN_CELL) return 'below';
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    return best;
  }
  function bestFit(m, v) {
    readFrame();
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 20; k++) {
      var res = candidates(m, b, v.W, v.H), lay = pick(res, v.W, v.H);
      all.push({ b: b, res: res, lay: lay, cell: res[lay] || 0 });
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    var max = 0;
    all.forEach(function (o) { if (o.cell > max) max = o.cell; });
    for (var i = 0; i < all.length; i++) if (all[i].cell >= max / 1.05) return all[i];
    return all[all.length - 1];
  }
  function cellSizeFor(m) { return bestFit(m, viewport()).cell; }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  var pauseBtn = $('#btn-pause'), toolsEl = $('#tools'), sideLeft = $('#side-left');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res, m, v) {
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    if (lay === 'wide') { if (pauseBtn.parentNode !== sideLeft) sideLeft.appendChild(pauseBtn); }
    else if (pauseBtn.parentNode !== toolsEl) toolsEl.appendChild(pauseBtn);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--side-w', Math.floor(res.sideW) + 'px');
    st.setProperty('--hud-h', Math.round(res.hudH) + 'px');
    st.setProperty('--cell', cell + 'px');
    var bw = m.w * cell + FRAME, bh = m.h * cell + FRAME;
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var panelW, toolCols, hudCols;
    if (lay === 'wide') { panelW = res.sideW; toolCols = 1; hudCols = 1; }
    else if (lay === 'side') { panelW = res.panelSide; toolCols = res.sideK; hudCols = res.hudColsSide; }
    else { toolCols = res.belowK; panelW = Math.min(v.W - 2 * res.p, Math.max(bw, toolCols * b + (toolCols - 1) * res.ig)); hudCols = res.hudColsBelow; }
    st.setProperty('--panel-w', Math.floor(panelW) + 'px');
    st.setProperty('--tool-cols', toolCols);
    st.setProperty('--hud-cols', hudCols);
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function layoutGame() {
    if (current !== 'game' || !game) return;
    var v = viewport(), m = game.state.map, small = isSmall(v);
    var floor = small ? SMALL_MIN : 84;
    var best = bestFit(m, v), b = best.b, lay, res, cell;
    for (var k = 0; k < 24; k++) {
      if (k === 0) { res = best.res; lay = best.lay; cell = best.cell; }
      else { res = candidates(m, b, v.W, v.H); lay = pick(res, v.W, v.H); cell = res[lay]; }
      if (!cell && b > floor) { b = Math.max(floor, b * 0.93); continue; }
      cell = Math.max(16, cell || 16);
      applyLayout(lay, b, cell, res, m, v);
      for (var t = 0; t < 12 && (overflows(gameEl) || overflows(root)) && cell > 16; t++) {
        cell = Math.max(16, Math.floor(cell * 0.96));
        applyLayout(lay, b, cell, res, m, v);
      }
      if (!overflows(gameEl) && !overflows(root)) break;
      if (b <= floor) break;
      b = Math.max(floor, b * 0.93);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }

  // ---------- Små skærme ----------
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('tt-lille', small);
    root.classList.toggle('tt-tvaers', small && v.W > v.H);
  }

  // Sider: blokkene (data-trin) fordeles på så få sider, som der er plads til.
  function makePager(screen, opts) {
    var nav = document.createElement('div');
    nav.className = 'trin-nav';
    nav.hidden = true;
    nav.innerHTML = '<button class="btn trin-prev" aria-label="Forrige side"><span class="icon" aria-hidden="true">‹</span><span class="big">Forrige</span></button>' +
      '<span class="trin-label" aria-live="polite"></span>' +
      '<button class="btn trin-next" aria-label="Næste side"><span class="icon" aria-hidden="true">›</span><span class="big">Næste</span></button>';
    opts.navIn.appendChild(nav);
    function placeNav() {
      var host = (opts.navBottom && !root.classList.contains('tt-tvaers')) ? opts.navBottom : opts.navIn;
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
      reset: function () {
        opts.all().forEach(function (el) { setHidden(el, false); });
        nav.hidden = true; pages = [];
        placeNav();
      },
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
    }),
    hjaelp: makePager($('#hjaelp'), {
      navIn: $('#hjaelp .hj-back-row'),
      all: function () { return $$('#hjaelp [data-trin]'); },
      blocks: function () { return $$('#hjaelp [data-trin]'); }
    })
  };

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

  // De andre skærme (og panelerne) tilpasses vinduet, til alt kan ses:
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
    var minB = small ? SMALL_MIN : 84;
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('tt-tvaers')) {
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
    resizeTimer = setTimeout(fitCurrent, 150);
  });

  // ---------- Start ----------
  TG.installer();
  buildHelp();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Taarnene = {
    chooseMap: chooseMap, cellSizeFor: cellSizeFor, askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return gazeGuard ? gazeGuard.id : null; },
    get game() { return game; }, get cursor() { return curIdx; }, get animating() { return anim.on; }, get selected() { return selIdx; },
    settings: arkade, gameSettings: tset, records: records, dwell: dwell, audio: audio, logik: L,
    start: startGame, show: show, chooseCell: chooseCell, build: doBuild, closePanels: closePanels,
    wave: waveButton, speed: speedButton, step: playStep, finish: finish, refresh: refresh,
    setPaused: setPaused, layout: layoutGame
  };
})();
