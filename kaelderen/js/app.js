/*
 * Kælderen – brugerflade: skærme, input, indstillinger, lyd, rekorder og kig-og-gå.
 * Bygger på de fælles moduler i ../arkade/ ligesom de andre spil.
 *
 * Alt er turbaseret: hvert skridt, drej og skud er én tur, og fjenderne flytter
 * sig kun derefter. Der er ingen tid. Skridt og drej glider ca. 0,3 sek. (eller
 * springer straks, når animation er slået fra, eller computeren er sat til mindre
 * bevægelse).
 *
 * Logikken ligger i js/logik.js (ingen DOM), tegningen i js/tegn.js (læser kun
 * tilstanden), lydene i js/lyd.js og al grafik i tema/<navn>/.
 */
(function () {
  'use strict';
  /* LUFT: mindst 24 px mellem knapper med forskellig betydning – en øjenstyring rammer inden for ca. 20–40 px */
  var LUFT = 24;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.KaelderLogik;
  var GLID = 300; // ms pr. skridt eller drej

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // gloed: neon-glød, glorie og scanlines. kvalitet: auto, lav, hoej. minikort: lille kort i billedet.
  // dwell3d: dwell virker også på døre, ting og fjender i 3D-billedet (kun når dwell er slået til).
  var gset = ArkadeSettings.create('kaelderen', { gloed: true, kvalitet: 'auto', minikort: true, dwell3d: true });
  if (['auto', 'lav', 'hoej'].indexOf(gset.get('kvalitet')) < 0) gset.set('kvalitet', 'auto');
  var records = ArkadeHighscores.create('kaelderen', { max: 10 });
  var REC = 'kaelderen';

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Et dwell på en spilknap = ét træk. Samme knap kan først dwelles igen, når
  // blikket har forladt den (så man ikke løber af sted ved et uheld).
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
  var SFX = { record: 'record', click: 'click', pause: 'pause' };
  // Spillets egne lyde (js/lyd.js, Web Audio). Et tema kan give dem andre klange (KaelderTema.lyde).
  var lyd = KaelderLyd.create({ sfx: arkade.get('sound'), volume: volumeSetting(), lyde: KaelderTema.lyde });
  function volumeSetting() {
    var v = arkade.all().volume;
    if (typeof v !== 'number' || isNaN(v)) return 1;
    return v > 1 ? v / 100 : v;
  }
  function sfx(name, n) { if (lyd.has(name)) lyd.play(name, n); else audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); lyd.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true); // TD Browse m.fl. kan klikke uden pointerdown
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
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse. Skridt og drej sker med det samme'
      : 'Skridt og drej glider blødt, og lyset lever lidt. Fra: alt sker med det samme';
    if (run) refresh();
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);

  arkade.onChange(function (key, value) {
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') { dwell.setEnabled(value); stopViewDwell(); }
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') { audio.setSfx(value); lyd.setSfx(value); }
    if (key === 'volume') lyd.setVolume(volumeSetting());
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-kaelder-gloed', gset.get('gloed') ? 'til' : 'fra'); restyle(); }
  function applyKvalitet() {
    tegn.setKvalitet(gset.get('kvalitet'));
    $('#kvalitet-note').textContent = gset.get('kvalitet') === 'auto' ? 'Auto tilpasser sig computeren' : gset.get('kvalitet') === 'lav' ? 'Grovere, men hurtig på svage computere' : 'Skarpest – kræver en hurtig computer';
  }
  gset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'kvalitet') applyKvalitet();
    if (key === 'dwell3d') stopViewDwell();
    syncSettingsUi();
    if (run) refresh();
  });
  function restyle() {
    if (typeof tegn !== 'undefined' && tegn) tegn.restyle();
    if (typeof demoTegn !== 'undefined' && demoTegn) demoTegn.restyle();
    drawMenuDemo();
    if (typeof run !== 'undefined' && run && current === 'game') renderView();
  }

  // ---------- Skærme ----------
  var current = 'menu';
  var settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    stopViewDwell();
    if (id === 'menu') syncMenu();
    if (id === 'game') { layoutGame(); startLoop(); } else fitScreen($('#' + id), true);
    var first = $('#' + id + ' [data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- Tekster ----------
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function turnsText(n) { return n === 1 ? '1 tur' : n + ' ture'; }
  function drabText(n) { return n === 1 ? '1 fjende' : n + ' fjender'; }
  var TINGNAVN = { ammo: 'ammunition', liv: 'førstehjælp', skat: 'skat', noegle: 'nøglekortet' };

  // ---------- Startmenu ----------
  // Et fast stillbillede fra kælderen (samme seed hver gang, med en kravler i gangen)
  var demoTegn = null, DEMO = null;
  function lavDemo() {
    var s = L.newState(20261029);
    var p = s.spiller;
    // Kig ned ad den længste lige vej fra start
    var best = -1;
    for (var d = 0; d < 4; d++) {
      var n = 0, x = p.x, y = p.y;
      while (L.gaaelig(L.cell(s, x + L.DX[d], y + L.DY[d])) && n < 12) { x += L.DX[d]; y += L.DY[d]; n++; }
      if (n > best) { best = n; p.dir = d; }
    }
    var k = Math.min(3, best);
    if (k >= 2) s.fjender.push({ id: 999, type: 'kravler', x: p.x + L.DX[p.dir] * k, y: p.y + L.DY[p.dir] * k, hp: 2, max: 2, vaagen: true, sidst: 0 });
    return s;
  }
  function drawMenuDemo() {
    var c = $('#menu-demo');
    if (!c || current !== 'menu' || c.offsetParent === null) return;
    var r = c.getBoundingClientRect(); if (r.width < 20) return;
    if (!DEMO) DEMO = lavDemo();
    if (!demoTegn) { demoTegn = KaelderTegn.create(c); demoTegn.setKvalitet('hoej'); }
    demoTegn.resize(r.width, r.height);
    demoTegn.overgang(null, DEMO.spiller, 0, false);
    demoTegn.render(DEMO, { animeret: false, gloed: gset.get('gloed'), minikort: false, trusler: [], vaabenSkjult: true }, performance.now());
  }
  function syncMenu() { if (current === 'menu') { fitScreen($('#menu')); drawMenuDemo(); } }
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(); });
  function goToHall() {
    sfx('click');
    audio.setMusic(false);
    [arkade, gset].forEach(function (s) {
      try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* fx privat tilstand */ }
    });
    location.href = $('#btn-hall').dataset.href;
  }
  $('#btn-hall').addEventListener('click', goToHall);
  window.addEventListener('pageshow', function (e) { if (e.persisted) audio.setMusic(arkade.get('music')); });
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
  function onFs() { syncFullscreen(); if (current === 'menu') syncMenu(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Spillet ----------
  var run = null, paused = false, finished = false, kortVist = false, hover = null, slutTimer = 0, butikTimer = 0;
  var viewEl = $('#view');
  var tegn = KaelderTegn.create(viewEl);
  var auto = null, autoTimer = 0, sidstTast = 0;

  function startGame(seed) {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    stopAuto();
    run = L.createRun(seed !== undefined ? { seed: seed } : {});
    paused = false; finished = false; kortVist = false; hover = null;
    clearTimeout(slutTimer); clearTimeout(butikTimer);
    hideOverlays();
    tegn.overgang(null, run.state.spiller, 0, false);
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#confirm-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); releaseGuard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && run.state.fase === 'spil' && current === 'game' && !overlayOpen(); }

  // Lyde til logikkens hændelser
  function lydFor(evs) {
    var spillet = {};
    evs.forEach(function (e) {
      var n = null;
      if (e.type === 'skridt') n = 'skridt';
      else if (e.type === 'drej') n = 'drej';
      else if (e.type === 'bump') n = 'bump';
      else if (e.type === 'doer') n = e.laast ? 'laas' : 'doer';
      else if (e.type === 'skud') n = 'skud';
      else if (e.type === 'traf') n = e.doed ? 'drab' : 'traf';
      else if (e.type === 'miss') n = 'miss';
      else if (e.type === 'slag') n = e.doed ? 'drab' : 'slag';
      else if (e.type === 'opdaget') n = 'fjende';
      else if (e.type === 'fjendeSkud' || e.type === 'fjendeSlag') n = 'fjendeSkud';
      else if (e.type === 'skade') n = 'skade';
      else if (e.type === 'ting') n = e.ting === 'noegle' ? 'noegle' : e.ting === 'skat' ? 'skat' : 'ting';
      else if (e.type === 'trappe') n = 'trappe';
      else if (e.type === 'doed') n = 'slut';
      if (n && !spillet[n]) { spillet[n] = true; sfx(n); }
    });
  }
  var RETNING_FOR = { frem: 0, hoejre: 1, tilbage: 2, venstre: 3 };
  // Ét træk. Returnerer logikkens svar
  function doAct(a, fraAuto) {
    if (!live()) return null;
    if (!fraAuto) stopAuto();
    var s = run.state, hp0 = s.spiller.hp;
    var r = run.act(a);
    var evs = s.haendelser.slice(), anim = animationOn();
    lydFor(evs);
    if (r.ok) {
      tegn.overgang(s.forrige, s.spiller, GLID, anim);
      tegn.haendelser(s, evs, anim);
    } else if (RETNING_FOR[a] !== undefined && evs.some(function (e) { return e.type === 'bump'; })) {
      tegn.stoed((s.spiller.dir + RETNING_FOR[a]) % 4, anim);
    }
    if (s.fase === 'butik') {
      stopAuto();
      butikTimer = setTimeout(openButik, anim ? 900 : 250);
    } else if (s.fase === 'slut') {
      stopAuto();
      slutTimer = setTimeout(function () { finish('doed'); }, 1600);
    }
    r.hp0 = hp0;
    refresh();
    startLoop();
    return r;
  }
  $$('#controls [data-act]').forEach(function (b) {
    b.classList.add('turn-btn');
    b.addEventListener('click', function () { if (swallowed(b)) return; if (kortVist && b.dataset.act !== 'handling') setKort(false); doAct(b.dataset.act); });
  });
  function setKort(v) {
    kortVist = v; hover = null;
    $('#btn-kort').setAttribute('aria-pressed', String(v));
    $('#kort-label').textContent = v ? 'Luk kort' : 'Kort';
    refresh();
  }
  $('#btn-kort').addEventListener('click', function () { if (!run || finished) return; sfx('click'); setKort(!kortVist); });

  // ---------- Kig-og-gå: gå automatisk hen til det, man peger på ----------
  function synligeFjender(s) { return s.fjender.filter(function (f) { return s.synlig[f.y * s.W + f.x]; }).map(function (f) { return f.id; }); }
  function stopAuto() { clearTimeout(autoTimer); autoTimer = 0; auto = null; }
  function startAuto(o) {
    stopAuto();
    auto = o;
    auto.kendte = synligeFjender(run.state);
    auto.hp = run.state.spiller.hp;
    autoTrin();
  }
  function retningMod(s, x, y) {
    var p = s.spiller;
    for (var d = 0; d < 4; d++) if (Math.sign(x - p.x) === L.DX[d] && Math.sign(y - p.y) === L.DY[d]) return d;
    return -1;
  }
  function drejMod(s, d) { var p = s.spiller; if (d === p.dir) return null; return ((d - p.dir + 4) % 4) === 1 ? 'drejH' : (((d - p.dir + 4) % 4) === 3 ? 'drejV' : 'drejH'); }
  function autoTrin() {
    autoTimer = 0;
    if (!auto || !live()) { auto = null; return; }
    var s = run.state, o = auto, p = s.spiller;
    // Mål nået?
    var fremme = o.faerdig ? o.faerdig(s) : (p.x === o.x && p.y === o.y);
    var a = null;
    if (fremme) {
      if (o.vend !== undefined && o.vend >= 0 && p.dir !== o.vend) a = drejMod(s, o.vend);
      if (!a) { var slut = o.ved; auto = null; if (slut) slut(s); refresh(); return; }
    } else {
      var rute = run.rute(o.x, o.y, { nabo: !!o.nabo });
      if (!rute) { auto = null; besked('Der er ingen kendt vej derhen.', true); return; }
      if (!rute.length) { if (o.nabo) { o.faerdig = function () { return true; }; autoTimer = setTimeout(autoTrin, 0); return; } auto = null; refresh(); return; }
      o.rute = rute;
      a = run.trinMod(rute[0].x, rute[0].y);
      if (!a) { auto = null; return; }
    }
    var r = doAct(a, true);
    if (!r || !r.ok || !auto) { auto = null; refresh(); return; }
    // Stop, hvis en ny fjende dukker op, eller hvis man bliver ramt
    var nu = synligeFjender(s);
    var ny = nu.filter(function (id) { return o.kendte.indexOf(id) < 0; });
    if (s.spiller.hp < o.hp) { auto = null; besked('Du blev ramt og stoppede.', true); return; }
    if (ny.length && !o.motFjende) { auto = null; besked('En fjende dukkede op. Du stoppede.', true); return; }
    o.kendte = nu;
    autoTimer = setTimeout(autoTrin, animationOn() ? GLID + 40 : 140);
  }
  var ekstraBesked = '', ekstraFejl = false;
  function besked(t, fejl) { ekstraBesked = t; ekstraFejl = !!fejl; refresh(); }

  function erForan(s, x, y) { var p = s.spiller; return p.x + L.DX[p.dir] === x && p.y + L.DY[p.dir] === y; }
  function iLinje(s, f) { var p = s.spiller; return (p.x === f.x || p.y === f.y) && Math.abs(p.x - f.x) + Math.abs(p.y - f.y) <= L.RULES.skudRaekke && L.ligeLinje(s, p.x, p.y, f.x, f.y); }
  // Hvad sker der, hvis man vælger dette mål? (tekst til markeringen)
  function maalTekst(t) {
    var s = run.state, m = L.maalForan(s);
    if (t.type === 'fjende') {
      var navn = L.FJENDER[t.fjende.type].navn;
      if (m && m.fjende === t.fjende) { var k = run.kontekst(); return k.type === 'skyd' ? 'Skyd ' + navn + ' (' + Math.round(k.chance * 100) + ' %)' : k.label + ': ' + navn; }
      return iLinje(s, t.fjende) ? 'Sigt på ' + navn : 'Gå mod ' + navn;
    }
    if (t.type === 'doer') return erForan(s, t.x, t.y) ? (t.laast ? (s.spiller.noegle ? 'Lås op' : 'Låst – find nøglekortet') : 'Åbn døren') : 'Gå til døren';
    if (t.type === 'ting') return 'Saml ' + (TINGNAVN[t.ting.type] || 'op');
    if (t.type === 'trappe') return 'Gå til trappen';
    return 'Gå hertil';
  }
  function feltKanNaas(s, x, y) {
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) return false;
    var i = y * s.W + x;
    return s.udforsket[i] && L.gaaelig(s.cells[i]) && !(s.spiller.x === x && s.spiller.y === y);
  }
  function vaelgMaal(t) {
    if (!t || !live()) return;
    var s = run.state, p = s.spiller;
    ekstraBesked = '';
    if (t.type === 'fjende') {
      var f = t.fjende, m = L.maalForan(s);
      if (m && m.fjende === f) { doAct('handling'); return; }
      if (iLinje(s, f)) { startAuto({ x: p.x, y: p.y, vend: retningMod(s, f.x, f.y), motFjende: true }); return; }
      startAuto({ x: f.x, y: f.y, nabo: true, motFjende: true, faerdig: function (st) { return iLinje(st, f) || f.hp <= 0; }, ved: function (st) { if (f.hp > 0 && iLinje(st, f) && !(L.maalForan(st) && L.maalForan(st).fjende === f)) startAuto({ x: st.spiller.x, y: st.spiller.y, vend: retningMod(st, f.x, f.y), motFjende: true }); } });
      return;
    }
    if (t.type === 'doer') {
      if (erForan(s, t.x, t.y)) { doAct('handling'); return; }
      startAuto({
        x: t.x, y: t.y, nabo: true,
        faerdig: function (st) { return Math.abs(st.spiller.x - t.x) + Math.abs(st.spiller.y - t.y) === 1; },
        // Står man ved døren, vendes ansigtet mod den (så Handling åbner den)
        ved: function (st) { var d = retningMod(st, t.x, t.y); if (d >= 0 && d !== st.spiller.dir) startAuto({ x: st.spiller.x, y: st.spiller.y, vend: d }); }
      });
      return;
    }
    if (t.type === 'ting' || t.type === 'trappe' || t.type === 'felt') {
      if (!feltKanNaas(s, t.x, t.y)) { if (t.kort || t.type !== 'felt') besked(t.type === 'felt' ? 'Du kan kun gå til steder, du har set.' : 'Der er ingen kendt vej derhen.', true); return; }
      startAuto({ x: t.x, y: t.y });
    }
  }
  function pegPaa(cx, cy) {
    var r = viewEl.getBoundingClientRect();
    var t = tegn.pick(cx - r.left, cy - r.top, kortVist);
    if (t && t.type === 'felt' && !kortVist && !feltKanNaas(run.state, t.x, t.y)) t = null;
    return t;
  }
  viewEl.addEventListener('click', function (e) {
    if (!live()) return;
    if (performance.now() - viewDwell.tAkt < 600) return; // dwell har lige valgt dette mål
    var t = pegPaa(e.clientX, e.clientY);
    if (!t) return;
    if (kortVist) { if (!feltKanNaas(run.state, t.x, t.y)) { besked('Vælg et sted, du har set.', true); return; } setKort(false); }
    vaelgMaal(t);
  });
  // Markering ved musen (ikke ved berøring)
  var hoverRaf = 0, hoverXY = null;
  viewEl.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    hoverXY = { x: e.clientX, y: e.clientY };
    if (!hoverRaf) hoverRaf = requestAnimationFrame(opdaterHover);
  });
  viewEl.addEventListener('pointerleave', function () { hoverXY = null; hover = null; stopViewDwell(); renderView(); });
  function opdaterHover() {
    hoverRaf = 0;
    if (!run || !hoverXY || !live()) { if (hover) { hover = null; renderView(); } return; }
    var t = pegPaa(hoverXY.x, hoverXY.y);
    var nyt = t ? { type: t.type, rect: t.rect, felt: (!t.rect && !kortVist) ? { x: t.x, y: t.y } : null, tekst: kortVist ? '' : maalTekst(t), x: t.x, y: t.y, kort: kortVist } : null;
    var key = function (h) { return h ? h.type + ':' + h.x + ':' + h.y : ''; };
    var skift = key(nyt) !== key(hover);
    hover = nyt;
    viewDwellOpdater(t);
    if (skift || (hover && hover.rect)) renderView();
  }

  // Dwell i 3D-billedet: kun døre, ting, fjender og trappen (på kortet: felter).
  // Gulv og vægge gør intet, så man kan kigge roligt rundt. Ét mål vælges kun én gang,
  // indtil blikket har været væk fra det.
  var ringEl = $('#view-ring'), ringProg = ringEl.querySelector('.arkade-dwell-progress');
  var viewDwell = { key: '', t0: 0, raf: 0, lock: '', maal: null, tAkt: -1e9 };
  function viewDwellOn() { return arkade.get('dwell') && gset.get('dwell3d'); }
  function viewDwellOpdater(t) {
    if (!viewDwellOn() || !live()) { stopViewDwell(); return; }
    var ok = t && (kortVist ? t.type === 'felt' && feltKanNaas(run.state, t.x, t.y) : t.type !== 'felt');
    var key = ok ? t.type + ':' + t.x + ':' + t.y : '';
    if (key !== viewDwell.lock) viewDwell.lock = '';
    if (!key || key === viewDwell.lock) { viewDwell.key = ''; ringEl.style.display = 'none'; return; }
    if (key !== viewDwell.key) { viewDwell.key = key; viewDwell.t0 = performance.now(); }
    viewDwell.maal = t;
    if (!viewDwell.raf) viewDwell.raf = requestAnimationFrame(viewDwellTick);
  }
  function viewDwellTick(now) {
    viewDwell.raf = 0;
    if (!viewDwell.key || !hoverXY || !live()) { ringEl.style.display = 'none'; return; }
    var p = Math.min(1, (now - viewDwell.t0) / (arkade.get('dwellTime') * 1000));
    var size = 84;
    ringEl.style.width = ringEl.style.height = size + 'px';
    ringEl.style.left = (hoverXY.x - size / 2) + 'px';
    ringEl.style.top = (hoverXY.y - size / 2) + 'px';
    ringProg.style.strokeDashoffset = String(100 - p * 100);
    ringEl.style.display = 'block';
    if (p >= 1) {
      var t = viewDwell.maal;
      viewDwell.lock = viewDwell.key; viewDwell.key = '';
      ringEl.style.display = 'none';
      if (kortVist) setKort(false);
      vaelgMaal(t);
      viewDwell.tAkt = performance.now();
      return;
    }
    viewDwell.raf = requestAnimationFrame(viewDwellTick);
  }
  function stopViewDwell() {
    if (viewDwell.raf) cancelAnimationFrame(viewDwell.raf);
    viewDwell.raf = 0; viewDwell.key = '';
    if (ringEl) ringEl.style.display = 'none';
  }

  // ---------- Tegneløkke ----------
  // Med animation: glidende skridt (fuld fart) og blødt levende lys (ca. 20 billeder i sek.).
  // Uden animation: der tegnes kun, når noget ændrer sig.
  var raf = 0, sidstTegnet = 0, maaling = null;
  function startLoop() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!run || current !== 'game') return;
    var travl = tegn.aktiv(now) || !!maaling;
    var lys = animationOn() && !paused;
    if (travl || (lys && now - sidstTegnet > 48)) renderView(now);
    if (maaling) { maaling.n++; maaling.ms += tegn.renderMs; if (now - maaling.t0 >= maaling.varighed) { var m = maaling; maaling = null; m.ok({ fps: m.n * 1000 / (now - m.t0), billeder: m.n, renderMs: tegn.renderMs, skala: tegn.skala, intern: tegn.intern }); } }
    if (travl || lys) raf = requestAnimationFrame(tick);
  }
  function viewState() {
    var s = run.state;
    return {
      animeret: animationOn(), gloed: gset.get('gloed'), minikort: gset.get('minikort'),
      kort: kortVist, hover: hover, trusler: run.trusler(),
      sigter: !!L.maalForan(s), rute: kortVist && auto && auto.rute ? auto.rute : null,
      kortValg: kortVist && hover && hover.kort ? { x: hover.x, y: hover.y } : null,
      kortTekst: 'Kort over etage ' + s.etage + (kortVist ? ' – vælg et sted, du har set' : '')
    };
  }
  function renderView(now) {
    if (!run || current !== 'game') return;
    tegn.render(run.state, viewState(), now || performance.now());
    sidstTegnet = now || performance.now();
  }

  // ---------- Status, knapper og besked ----------
  var IKON_FOR = { skyd: 'skyd', slaa: 'slaa', ingenAmmo: 'skyd', ned: 'trappe', tilTrappe: 'trappe', aabn: 'aabn', aabnLaast: 'laas-op', laast: 'laast', saml: 'saml', vent: 'vent', ingen: 'vent' };
  function refresh() {
    if (!run) return;
    var s = run.state, p = s.spiller;
    $('#hud-etage').textContent = s.etage;
    $('#hud-liv').textContent = p.hp + '/' + p.maxHp;
    $('#hud-ammo').textContent = p.ammo + '/' + p.maxAmmo;
    $('#hud-skat').textContent = s.skat;
    $('#hud-liv').closest('.hud').classList.toggle('lav', p.hp <= Math.max(3, p.maxHp * 0.3));
    $('#hud-ammo').closest('.hud').classList.toggle('lav', p.ammo === 0);
    $('#hud-noegle').hidden = !p.noegle;
    var on = live();
    // Knapperne: gå er slået fra, hvor man ikke kan gå
    var kan = function (d) { var x = p.x + L.DX[d], y = p.y + L.DY[d]; return L.gaaelig(L.cell(s, x, y)) && !L.fjendeVed(s, x, y); };
    $$('#controls [data-act]').forEach(function (b) {
      var a = b.dataset.act, ok = on;
      if (ok && RETNING_FOR[a] !== undefined) ok = kan((p.dir + RETNING_FOR[a]) % 4);
      b.disabled = !ok;
    });
    $('#btn-kort').disabled = !on && !kortVist;
    var k = run.kontekst();
    var lbl = k.label || 'Vent', sub = '';
    if (k.type === 'skyd') sub = Math.round(k.chance * 100) + ' % træf · ' + k.navn;
    else if (k.type === 'slaa') sub = k.navn + ' · nærkamp';
    else if (k.type === 'ingenAmmo') sub = 'gå tæt på for at slå';
    else if (k.type === 'laast') { lbl = 'Låst'; sub = 'find nøglekortet'; }
    else if (k.type === 'saml') sub = TINGNAVN[k.ting.type] || '';
    else if (k.type === 'vent') sub = 'én tur';
    $('#handling-label').textContent = lbl;
    $('#handling-sub').textContent = sub;
    $('#handling-ico').setAttribute('href', '#kaelder-ikon-' + (IKON_FOR[k.type] || 'vent'));
    $('#btn-handling').disabled = !on || k.kan === false;
    $('#btn-handling').setAttribute('aria-label', lbl + (sub ? ', ' + sub : ''));
    // Beskedlinjen nederst i billedet
    var el = $('#besked'), tekst = ekstraBesked || s.besked || '', fejl = ekstraFejl && !!ekstraBesked;
    var fr = run.foran(), foran = '';
    if (fr.type === 'fjende') foran = 'Foran dig: ' + L.FJENDER[fr.fjende.type].navn + ' (' + fr.fjende.hp + '/' + fr.fjende.max + ' liv)';
    else if (fr.type === 'doer') foran = 'Foran dig: en dør';
    else if (fr.type === 'laast') foran = 'Foran dig: den låste dør';
    else if (fr.type === 'trappe') foran = 'Foran dig: trappen ned';
    else if (fr.type === 'ting') foran = 'Foran dig: ' + TINGNAVN[fr.ting.type];
    var tr = run.trusler();
    if (!foran && tr.length) foran = tr.length === 1 ? '1 fjende kan ramme dig' : tr.length + ' fjender kan ramme dig';
    el.textContent = '';
    if (tekst) el.appendChild(document.createTextNode(tekst));
    if (foran) { if (tekst) el.appendChild(document.createTextNode(' · ')); var sp = document.createElement('span'); sp.className = 'foran'; sp.textContent = foran; el.appendChild(sp); }
    el.classList.toggle('fejl', fejl || (s.sidsteSkade && s.sidsteSkade.tur === s.tur));
    viewEl.setAttribute('aria-label', 'Kælderen, etage ' + s.etage + '. ' + (foran || 'Gangen foran dig er fri') + '.');
    renderView();
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  function setPaused(p) {
    if (!run || finished || run.state.fase !== 'spil') return;
    paused = p;
    stopAuto();
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset(); stopViewDwell();
    if (p) guardUnderGaze($('#pause-overlay')); else releaseGuard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true }); else startLoop();
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit(); });

  // ---------- Bekræft Afslut ----------
  function askQuit() {
    if (!run || finished) return;
    stopAuto();
    paused = true;
    $('#pause-overlay').hidden = true;
    $('#confirm-text').textContent = 'Du har ' + pointsText(run.point()) + ' på etage ' + run.state.etage + '. Pointene gemmes i rekorderne.';
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
    releaseGuard(); dwell.reset();
    sfx('click');
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (current !== 'game') show('game');
    refresh(); startLoop();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); releaseGuard(); finish('quit'); });
  function quitToMenu() { run = null; paused = false; stopAuto(); clearTimeout(slutTimer); clearTimeout(butikTimer); hideOverlays(); show('menu'); }

  // ---------- Butik mellem etagerne ----------
  var VARE_IKON = { liv: 'liv', heal: 'liv', vaaben: 'skyd', magasin: 'ammo', ammo: 'ammo', rustning: 'rustning', lygte: 'syn' };
  function vareNiveau(id, p) {
    if (id === 'liv') return 'Nu: ' + p.maxHp + ' liv';
    if (id === 'heal') return 'Nu: ' + p.hp + '/' + p.maxHp;
    if (id === 'vaaben') return 'Skade ' + p.vaaben + ' af ' + L.RULES.maxVaaben;
    if (id === 'magasin') return 'Nu: ' + p.maxAmmo + ' skud';
    if (id === 'ammo') return 'Nu: ' + p.ammo + '/' + p.maxAmmo;
    if (id === 'rustning') return 'Niveau ' + p.rustning + ' af ' + L.RULES.maxRustning;
    if (id === 'lygte') return 'Niveau ' + p.lygte + ' af ' + L.RULES.maxLygte;
    return '';
  }
  function openButik(beskedTekst, fejl) {
    if (!run || run.state.fase !== 'butik') return;
    var s = run.state, p = s.spiller, varer = run.butik();
    $('#butik-title').textContent = 'Etage ' + s.etage + ' klaret – butikken';
    $('#butik-skat').textContent = s.skat;
    $('#butik-status').textContent = 'Liv ' + p.hp + '/' + p.maxHp + ' · Ammo ' + p.ammo + '/' + p.maxAmmo + (p.rustning ? ' · Rustning ' + p.rustning : '');
    $('#videre-label').textContent = 'Gå ned til etage ' + (s.etage + 1);
    var vp = viewport();
    $('#butik').style.setProperty('--vare-cols', vp.W < 600 ? 2 : (vp.W < 1100 && vp.W / vp.H < 1.2 ? 3 : 4));
    var box = $('#butik-varer'), fokus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.vare : null;
    box.innerHTML = '';
    varer.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'btn vare'; b.dataset.vare = v.id; b.disabled = !v.kan;
      b.innerHTML = '<svg aria-hidden="true" viewBox="0 0 100 100"><use href="#kaelder-ikon-' + VARE_IKON[v.id] + '"/></svg><span class="vare-tekst"><span class="big"></span><span class="small"></span><span class="pris"></span></span>';
      b.querySelector('.big').textContent = v.navn;
      b.querySelector('.small').textContent = v.tekst + ' · ' + vareNiveau(v.id, p);
      b.querySelector('.pris').textContent = v.kan ? v.pris + ' skat' : (v.grund === 'For lidt skat' ? v.pris + ' skat – for lidt' : v.grund);
      b.setAttribute('aria-label', v.navn + '. ' + v.tekst + '. ' + (v.kan ? 'Pris ' + v.pris + ' skat' : v.grund));
      b.addEventListener('click', function () { koeb(v.id); });
      box.appendChild(b);
    });
    var bm = $('#butik-besked');
    bm.textContent = beskedTekst || (varer.some(function (v) { return v.kan; }) ? 'Køb udstyr for din skat, eller gå videre.' : 'Du har ikke skat nok til mere lige nu.');
    bm.classList.toggle('fejl', !!fejl);
    if (current !== 'butik') show('butik'); else fitScreen($('#butik'));
    var f = fokus && $('#butik-varer [data-vare="' + fokus + '"]');
    if (f && !f.disabled) f.focus({ preventScroll: true });
  }
  function koeb(id) {
    if (!run) return;
    var navn = (L.BUTIK.filter(function (v) { return v.id === id; })[0] || {}).navn || '';
    if (run.koeb(id)) { sfx('opgradering'); openButik('Købt: ' + navn + '.'); }
    else { sfx('bump'); openButik('Det kan du ikke købe lige nu.', true); }
  }
  $('#btn-videre').addEventListener('click', function () {
    if (!run || run.state.fase !== 'butik') return;
    sfx('click');
    run.naesteEtage();
    kortVist = false; hover = null; $('#btn-kort').setAttribute('aria-pressed', 'false'); $('#kort-label').textContent = 'Kort';
    tegn.overgang(null, run.state.spiller, 0, false);
    show('game');
    refresh();
  });

  // ---------- Slut ----------
  var lastEntryId = null;
  function saveRecord() {
    var out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(REC, out.score, { etage: out.etage, skat: out.skat, drab: out.drab });
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    clearTimeout(slutTimer); clearTimeout(butikTimer); stopAuto();
    var s = run.state, res = saveRecord(), rankText;
    lastEntryId = null;
    if (res) {
      if (res.rank === 1) { rankText = 'Ny rekord!'; sfx('record'); }
      else if (res.rank > 0) rankText = 'Du kom ind som nr. ' + res.rank + ' på listen';
      else rankText = 'Ikke på top 10 denne gang';
      if (res.rank > 0) lastEntryId = res.entry.id;
    } else rankText = 'Ingen point denne gang';
    paused = false; hideOverlays();
    $('#go-title').textContent = s.fase === 'slut' ? 'Du faldt i kælderen' : 'Spillet er slut';
    $('#go-reason').textContent = s.fase === 'slut' ? (s.doedAf || 'En fjende') + ' fik dig på etage ' + s.etage + '.' : 'Du stoppede på etage ' + s.etage + '.';
    $('#go-score').textContent = run.point();
    $('#go-detaljer').textContent = 'Etage ' + s.etage + ' · ' + s.skatIalt + ' skat · ' + drabText(s.drab) + ' nedkæmpet';
    $('#go-rank').textContent = rankText;
    renderRecordList($('#go-records'), lastEntryId);
    show('gameover');
  }
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
        lv.textContent = ' · etage ' + (typeof e.etage === 'number' ? e.etage : 1);
        sc.appendChild(lv);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
        if (e.id === highlightId) li.classList.add('new');
      } else li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      ol.appendChild(li);
    }
  }
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
      sfx('click'); syncSettingsUi();
    });
  });
  function stepDwell(delta) {
    var v = Math.min(3, Math.max(0.5, Math.round((arkade.get('dwellTime') + delta) * 100) / 100));
    arkade.set('dwellTime', v);
    sfx('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('click');
    if (settingsReturn === 'game' && run && !finished && run.state.fase === 'spil') { show('game'); $('#pause-overlay').hidden = false; fitScreen($('#pause-overlay')); refresh(); $('#btn-resume').focus({ preventScroll: true }); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Pil op/W frem, pil ned/S tilbage, pil venstre/A og pil højre/D drejer,
  // Q og E går til siden, mellemrum eller Enter er Handling, M er kortet, Esc eller P giver pause.
  var TASTER = { ArrowUp: 'frem', w: 'frem', ArrowDown: 'tilbage', s: 'tilbage', ArrowLeft: 'drejV', a: 'drejV', ArrowRight: 'drejH', d: 'drejH', q: 'venstre', e: 'hoejre', ' ': 'handling', Enter: 'handling' };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') return;
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'm') { e.preventDefault(); if (!e.repeat) { sfx('click'); setKort(!kortVist); } return; }
    var a = TASTER[k];
    if (!a) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    var now = performance.now();
    if (e.repeat && (a === 'handling' || now - sidstTast < 180)) return;
    sidstTast = now;
    if (kortVist && a !== 'handling') setKort(false);
    doAct(a);
  });
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapperne er mindst ca. 3 cm, når der er plads, og aldrig under 84 px.
  // Det layout, der giver det største 3D-billede, vælges.
  var LAYOUTS = ['wide', 'side', 'below'];
  var MIN_B = 84;
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(22, mn * 0.02)) }; }
  function fitView(aw, ah) {
    if (aw < 120 || ah < 90) return null;
    var w = aw, h = ah;
    if (w / h > 2.1) w = Math.floor(h * 2.1);
    if (w / h < 0.8) h = Math.floor(w / 0.8);
    return { w: Math.floor(w), h: Math.floor(h), a: w * h };
  }
  function candidates(b, W, H) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = Math.min(W, H) < 560 ? 10 : LUFT;   // mobil (under 560 px): som før
    var ctl = 3 * b + 2 * ig, res = { p: p, g: g, ig: ig, ctl: ctl };
    // wide: status lodret til venstre
    var statusW = Math.max(150, Math.min(250, b * 1.6));
    var hudW = Math.max(44, Math.min(80, (H - 2 * p - b - 4 * ig) / 4));
    res.statusW = statusW; res.hudWide = hudW;
    res.wide = (ctl <= H - 2 * p && hudW >= 44) ? fitView(W - 2 * p - statusW - ctl - 2 * g, H - 2 * p) : null;
    // side: status (2 × 2 + pause) over styrekrydset til højre
    var statusSide = Math.max(b, Math.min(2 * 64 + ig, H - 2 * p - g - ctl));
    res.hudSide = Math.max(40, (statusSide - ig) / 2);
    res.statusSide = statusSide;
    res.side = (statusSide + g + ctl <= H - 2 * p) ? fitView(W - 2 * p - ctl - g, H - 2 * p) : null;
    // below: status på én række øverst, styrekrydset nederst
    res.below = (ctl <= W - 2 * p) ? fitView(W - 2 * p, H - 2 * p - b - ctl - 2 * g) : null;
    return res;
  }
  function pickLayout(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (res[l] && (best === null || res[l].a > res[best].a * 1.03)) best = l; });
    return best;
  }
  function bestFit(v) {
    var b = Math.max(MIN_B, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 24; k++) {
      var res = candidates(b, v.W, v.H), lay = pickLayout(res);
      all.push({ b: b, res: res, lay: lay, a: lay ? res[lay].a : 0 });
      if (b <= MIN_B) break;
      b = Math.max(MIN_B, b * 0.95);
    }
    var max = 0;
    all.forEach(function (o) { if (o.a > max) max = o.a; });
    // Største knapper, der stadig giver næsten det største billede
    for (var i = 0; i < all.length; i++) if (all[i].lay && all[i].a >= max / 1.12) return all[i];
    return all[all.length - 1];
  }
  var gameEl = $('#game'), gridEl = $('#game-grid');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, f, res, v) {
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px');
    st.setProperty('--gap', Math.max(10, cssGap(v.W, v.H) * Math.min(1, b / cssBtn(v.W, v.H))) + 'px');
    st.setProperty('--game-pad', res.p + 'px');
    st.setProperty('--game-gap', res.g + 'px');
    st.setProperty('--ig', res.ig + 'px');
    st.setProperty('--status-w', Math.floor(res.statusW) + 'px');
    st.setProperty('--ctl-w', Math.floor(res.ctl) + 'px');
    st.setProperty('--col-w', Math.floor(Math.max(res.ctl, f.w)) + 'px');
    st.setProperty('--hud-h', Math.floor(lay === 'wide' ? res.hudWide : lay === 'side' ? res.hudSide : b) + 'px');
    st.setProperty('--view-w', f.w + 'px');
    st.setProperty('--view-h', f.h + 'px');
    st.setProperty('--besked-str', Math.max(0.9, Math.min(1.35, f.w / 700)) + 'rem');
    gameEl.dataset.layout = lay;
    gameEl.dataset.view = f.w + 'x' + f.h;
    // Smalle statusfelter på højkant: ikonet gør plads til tallet
    gridEl.classList.toggle('smal', lay === 'below' && (f.w - b - 4 * res.ig) / 4 < 120);
    tegn.resize(f.w, f.h);
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), best = bestFit(v), b = best.b, lay = best.lay, res = best.res;
    if (!lay) { res = candidates(MIN_B, v.W, v.H); lay = 'below'; b = MIN_B; res.below = { w: Math.max(120, v.W - 2 * res.p), h: 90, a: 0 }; }
    var f = res[lay];
    applyLayout(lay, b, f, res, v);
    for (var t = 0; t < 30 && (overflows(gameEl) || overflows(root)) && f.w > 120; t++) {
      f = { w: Math.floor(f.w * 0.96), h: Math.floor(f.h * 0.96), a: 0 };
      applyLayout(lay, b, f, res, v);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    renderView();
  }

  // ---------- Små skærme ----------
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('kaelder-lille', small);
    root.classList.toggle('kaelder-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('kaelder-tvaers')) ? opts.navBottom : opts.navIn;
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
    var minB = SMALL_MIN;
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('kaelder-tvaers')) {
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
  KaelderTegn.installerIkoner();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  applyKvalitet();
  syncFullscreen();
  syncSettingsUi();
  show('menu');
  drawMenuDemo();

  // Til test og fejlfinding
  window.Kaelderen = {
    askQuit: askQuit, cancelQuit: cancelQuit,
    get run() { return run; }, get tegn() { return tegn; }, get auto() { return auto; }, get kortVist() { return kortVist; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    start: startGame, show: show, act: doAct, vaelg: vaelgMaal, pick: function (x, y) { return tegn.pick(x, y, kortVist); },
    setKort: setKort, openButik: openButik, koeb: koeb, finish: finish, refresh: refresh, setPaused: setPaused, layout: layoutGame,
    // Mål billedraten: tegner hvert billede i `ms` millisekunder
    maalFps: function (ms) { return new Promise(function (ok) { maaling = { t0: performance.now(), n: 0, ms: 0, varighed: ms || 3000, ok: ok }; startLoop(); }); }
  };
})();
