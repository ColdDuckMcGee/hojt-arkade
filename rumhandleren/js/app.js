/*
 * Rumhandleren – app.js: skærme, knapper, layout, dwell, tastatur, indstillinger,
 * rekorder og gem. Spillets regler ligger i js/logik.js (kender ingen farver),
 * tegningerne i js/tegn.js og grafikken i tema/<navn>/.
 *
 * Alt er turbaseret: intet sker, før spilleren vælger. Ingen kamp og ingen tåge –
 * hele stjernekortet kan ses fra start.
 */
(function () {
  'use strict';

  var $ = function (sel, r) { return (r || document).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.RumhandlerenLogik, T = window.RumhandlerenTegn;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var gset = ArkadeSettings.create('rumhandleren', { gloed: true });
  var records = ArkadeHighscores.create('rumhandleren', { max: 10 });
  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Spillet, der er i gang ----------
  var SAVE_KEY = 'hojtArkade.rumhandleren.spil';
  function loadGame() {
    try { var raw = localStorage.getItem(SAVE_KEY); var g = raw ? JSON.parse(raw) : null; return g && !g.over && g.planeter && g.skibe ? g : null; } catch (e) { return null; }
  }
  function saveGame() {
    try {
      if (game && !game.state.over) localStorage.setItem(SAVE_KEY, JSON.stringify(game.save()));
      else if (game) localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* fx privat tilstand */ }
  }
  var game = null;

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
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
    if (lastPX < 0 || !rootEl) return;
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
  // Samme knap kan ikke dwelles to gange i træk uden at blikket har forladt den (fx "Vent 1 dag")
  function swallowed(el) { if (suppress === el) { suppress = null; return true; } return false; }
  function onAct(el, fn) { el.addEventListener('click', function (e) { if (!swallowed(el)) fn(e); }); }

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  function volumeSetting() {
    var v = arkade.all().volume;
    if (typeof v !== 'number' || isNaN(v)) return 1;
    return v > 1 ? v / 100 : v;
  }
  var lyd = RumhandlerenLyd.create({ sfx: arkade.get('sound'), volume: volumeSetting() });
  function sfx(name) { if (name === 'click') audio.play('click'); else lyd.play(name); }
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
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    root.classList.toggle('rh-stille', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden. Selve spillet står altid stille.';
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);
  arkade.onChange(function (key, value) {
    if (key === 'theme') { applyTheme(); if (current === 'game') refresh(); }
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') dwell.setEnabled(value);
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') { audio.setSfx(value); lyd.setSfx(value); }
    if (key === 'volume') lyd.setVolume(volumeSetting());
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-rh-gloed', gset.get('gloed') ? 'til' : 'fra'); }
  gset.onChange(function (key) { if (key === 'gloed') applyGlow(); syncSettingsUi(); });

  // ---------- Tekster ----------
  function tal(n) { n = Math.round(n); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '−' : '') + s; }
  function cr(n) { return tal(n) + ' cr'; }
  function stk(n, ental, flertal) { return tal(n) + ' ' + (n === 1 ? ental : flertal); }
  function dage(n) { return stk(n, 'dag', 'dage'); }
  function pNavn(id) { return L.PLANET[id] ? L.PLANET[id].navn : ''; }
  function vNavn(id) { return L.VARE[id].navn.toLowerCase(); }
  function fNavn(id) { return L.FRAKTION[id].navn; }
  function esc(s) { return T.esc(s); }
  function liste(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' og ' + arr[arr.length - 1]; }
  function lastTekst(last) {
    var d = []; L.VARER.forEach(function (v) { if (last && last[v.id]) d.push(last[v.id] + ' ' + vNavn(v.id)); });
    return d.length ? liste(d) : 'tomt';
  }
  function sumLast(last) { var n = 0; for (var k in last) n += last[k] || 0; return n; }
  var RISIKO = ['ingen pirater', 'nogle pirater', 'mange pirater'];
  var RISIKO_CLS = ['ok', 'adv', 'fejl'];
  var GRUND = {
    konkurs: 'Du kunne ikke betale månedens regning og gik konkurs.',
    pension: 'Du gik på pension med din formue.'
  };

  // ---------- Skærme ----------
  var current = 'menu', settingsReturn = 'menu';
  function show(id) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    current = id;
    dwell.reset();
    if (id === 'menu') syncMenu();
    if (id === 'game') { layoutGame(); } else fitScreen($('#' + id), true);
    guardUnderGaze($('#' + id));
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var gemt = loadGame();
    if (gemt) {
      $('#btn-start-label').textContent = 'Fortsæt handlen';
      $('#btn-start-sub').textContent = 'Dag ' + gemt.dag + ' · ' + cr(gemt.kredit) + ' · ' + stk(gemt.skibe.length, 'skib', 'skibe');
    } else {
      $('#btn-start-label').textContent = 'Ny handel';
      $('#btn-start-sub').textContent = 'En lille Spurv og ' + cr(L.START.kredit);
    }
    $('#btn-ny').hidden = !gemt;
    if (current === 'menu') fitScreen($('#menu'));
  }
  $('#btn-start').addEventListener('click', function () { sfx('click'); var g = loadGame(); if (g) fortsaetSpil(g); else nyHandel(); });
  $('#btn-ny').addEventListener('click', function () {
    sfx('click');
    var g = loadGame();
    if (!g) { nyHandel(); return; }
    bekraeft({
      titel: 'Start forfra?', tekst: 'Det gemte spil (dag ' + g.dag + ', ' + cr(g.kredit) + ') forsvinder og kommer ikke på listen.',
      nej: 'Nej, behold det', ja: 'Ja, ny handel', ikon: 'flyv', paaJa: nyHandel
    });
  });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords('menu'); });
  function goToHall() {
    sfx('click');
    audio.setMusic(false);
    [arkade, gset].forEach(function (s) { try { localStorage.setItem(s.storageKey, JSON.stringify(s.all())); } catch (e) { /* */ } });
    saveGame();
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
  function onFs() { syncFullscreen(); fitCurrent(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // ---------- Bekræft (to store knapper; "Nej" har fokus) ----------
  var bekraeftJa = null, bekraeftFra = null;
  function bekraeft(o) {
    $('#bekraeft-title').textContent = o.titel;
    $('#bekraeft-text').textContent = o.tekst;
    $('#bekraeft-nej-label').textContent = o.nej;
    $('#bekraeft-ja-label').textContent = o.ja;
    $('#bekraeft-ikon').setAttribute('href', '#rh-ikon-' + (o.ikon || 'ok'));
    bekraeftJa = o.paaJa;
    var ov = $('#bekraeft-overlay');
    bekraeftFra = document.activeElement;
    ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
    $('#btn-bekraeft-nej').focus({ preventScroll: true });
  }
  function lukBekraeft() { $('#bekraeft-overlay').hidden = true; releaseGuard(); dwell.reset(); bekraeftJa = null; }
  function bekraeftOpen() { return !$('#bekraeft-overlay').hidden; }
  $('#btn-bekraeft-nej').addEventListener('click', function () {
    sfx('click'); lukBekraeft();
    if (bekraeftFra && bekraeftFra.focus && document.contains(bekraeftFra)) bekraeftFra.focus({ preventScroll: true });
  });
  onAct($('#btn-bekraeft-ja'), function () { var f = bekraeftJa; lukBekraeft(); sfx('click'); if (f) f(); });

  // ---------- Spillets tilstand i brugerfladen ----------
  // view: 'kort', 'marked', 'skibe', 'bygninger', 'kontrakter' eller 'gaeld'
  var view = 'kort', valgtPlanet = null, valgtVare = 'mad', valgtSkib = null, bygSide = 0;
  var kListe = 'tilbud', kValg = 0, ruteValg = null;
  var besked = { tekst: '', cls: '' }, paused = false, slutVist = false, sidstSet = null;
  var OVERLAYS = ['#pause-overlay', '#slut-overlay', '#pirat-overlay', '#skib-overlay'];
  function overlayOpen() { return bekraeftOpen() || OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); paused = false; releaseGuard(); }
  function setBesked(t, cls) { besked = { tekst: t, cls: cls || '' }; }

  // Nyheder, der er kommet til siden sidst (logikken lægger dem forrest i state.nyheder)
  function nyeNyheder() {
    var ny = game.state.nyheder, ud = [];
    for (var i = 0; i < ny.length; i++) {
      if (sidstSet && ny[i].dag === sidstSet.dag && ny[i].tekst === sidstSet.tekst) break;
      ud.push(ny[i]);
    }
    sidstSet = ny[0] ? { dag: ny[0].dag, tekst: ny[0].tekst } : null;
    return ud;
  }
  // Sæt beskedlinjen efter en handling, der har fået dage til at gå
  function efterDage(tekst, cls) {
    var ny = nyeNyheder();
    var vigtig = ny.filter(function (n) { return n.slags === 'fejl'; })[0] || ny.filter(function (n) { return n.slags === 'nyhed'; })[0] ||
      ny.filter(function (n) { return /regning/i.test(n.tekst); })[0];
    if (vigtig) {
      tekst = (tekst ? tekst + ' · ' : '') + vigtig.tekst;
      if (vigtig.slags === 'fejl') cls = 'fejl'; else if (!cls && vigtig.slags === 'nyhed') cls = 'nyhed';
      if (/regning.*betalt/i.test(vigtig.tekst)) sfx('regning'); else if (vigtig.slags === 'nyhed') sfx('nyhed');
    }
    setBesked(tekst, cls);
  }

  function nulstilValg() {
    valgtPlanet = null; valgtSkib = game.state.flagskib; bygSide = 0; kListe = 'tilbud'; kValg = 0; ruteValg = null;
    view = 'kort'; sidstSet = null; nyeNyheder(); slutVist = false;
  }
  function nyHandel() {
    game = L.createGame();
    nulstilValg(); valgtVare = 'mad';
    setBesked('Velkommen til ' + pNavn(game.her()) + '! Vælg en planet for at se rejsetid, brændstof og fortjeneste.');
    saveGame(); hideOverlays();
    show('game'); sfx('ankomst');
  }
  function fortsaetSpil(gemt) {
    game = L.createGame(gemt);
    nulstilValg();
    setBesked('Velkommen tilbage. Du er på ' + pNavn(game.her()) + ', dag ' + game.state.dag + '.');
    hideOverlays(); show('game');
  }
  function spilAktivt() { return current === 'game' && game && !game.state.over && !overlayOpen(); }

  function setView(v) {
    if (v !== 'kort' && ruteValg) ruteValg = null;
    view = v;
    layoutGame();
    guardUnderGaze($('#v-' + v));
  }
  $$('.fane-btn[data-fane]').forEach(function (b) {
    b.addEventListener('click', function () { if (!spilAktivt()) return; sfx('click'); setView(b.dataset.fane); });
  });

  // ---------- Statuslinjen ----------
  function syncHud() {
    var st = game.state, s = game.flagskib(), t = L.SKIBSTYPE[s.type], r = game.regning(), nf = game.naesteForfald();
    var lav = gameEl.classList.contains('lay-lav');
    function hud(k, v, label) { var el = $('[data-hud="' + k + '"]'); $('.hud-value', el).textContent = v; if (label) $('.hud-label', el).textContent = label; return el; }
    hud('dag', String(st.dag));
    hud('kredit', tal(st.kredit));
    hud('gaeld', tal(st.gaeld));
    var f = hud('forfald', (lav ? 'd' + nf + ' ' : '') + tal(r.total), (gameEl.classList.contains('smal') ? 'Regn. d. ' : 'Regning dag ') + nf);
    f.classList.toggle('advarsel', st.kredit < r.total);
    f.title = 'Næste regning: ' + cr(r.total) + ' på dag ' + nf + ' (om ' + dage(nf - st.dag) + ')';
    hud('braendstof', s.braendstof + '/' + t.tank);
    hud('last', sumLast(s.last) + '/' + t.last);
  }
  function syncBesked() {
    var b = $('#besked');
    var t = besked.tekst;
    if (!t) { var n = game.state.nyheder[0]; t = n ? n.tekst : ''; }
    b.textContent = t; b.className = 'besked' + (besked.cls ? ' ' + besked.cls : '');
    b.title = t;
  }
  function syncFaner() {
    $$('.fane-btn[data-fane]').forEach(function (b) {
      var on = b.dataset.fane === view;
      b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on));
    });
  }

  function refresh() {
    if (!game || current !== 'game') return;
    $$('#spil .view').forEach(function (el) { el.hidden = el.id !== 'v-' + view; });
    syncHud(); syncBesked(); syncFaner();
    syncView();
    if (game.state.over) slutSpil();
    else if (game.state.moede && $('#pirat-overlay').hidden && !paused) visPirat();
  }
  function syncView() {
    if (view === 'kort') syncKort();
    else if (view === 'marked') syncMarked();
    else if (view === 'skibe') syncSkibe();
    else if (view === 'bygninger') syncBygninger();
    else if (view === 'kontrakter') syncKontrakter();
    else syncGaeld();
  }

  // ---------- Stjernekortet ----------
  var planetBtns = {};
  (function byggPlanetKnapper() {
    var lag = $('#planet-lag');
    L.PLANETER.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'btn planet-btn'; b.dataset.planet = p.id;
      b.setAttribute('aria-label', p.navn);
      onAct(b, function () { if (!spilAktivt()) return; sfx('click'); vaelgPlanet(p.id); });
      lag.appendChild(b); planetBtns[p.id] = b;
    });
  })();
  function vaelgPlanet(id) { valgtPlanet = id; refresh(); }
  function skiftPlanet(d) {
    var ids = L.PLANETER.map(function (p) { return p.id; });
    var i = ids.indexOf(valgtPlanet || game.her());
    vaelgPlanet(ids[(i + d + ids.length) % ids.length]);
  }
  onAct($('#btn-forrige-planet'), function () { if (!spilAktivt()) return; sfx('click'); skiftPlanet(-1); });
  onAct($('#btn-naeste-planet'), function () { if (!spilAktivt()) return; sfx('click'); skiftPlanet(1); });

  function planetFakta(id) {
    var p = L.PLANET[id], d = [];
    var laves = L.VARER.filter(function (v) { return (p.n[v.id] || 0) > 0; }).map(function (v) { return vNavn(v.id); });
    var mangler = L.VARER.filter(function (v) { return (p.n[v.id] || 0) < 0; }).map(function (v) { return vNavn(v.id); });
    if (laves.length) d.push('Laver ' + liste(laves));
    if (mangler.length) d.push('mangler ' + liste(mangler));
    return d.join(' · ');
  }
  function eventsHer(id) { return game.state.events.filter(function (e) { return e.planet === id; }); }

  function syncKort() {
    var st = game.state, her = game.her(), id = valgtPlanet || her, p = L.PLANET[id];
    var info = '', sti = null;
    var fr = '<span class="fr-' + p.fraktion + '">' + esc(fNavn(p.fraktion)) + '</span>';
    var evs = eventsHer(id).map(function (e) { return '<p class="adv">' + esc(e.tekst) + '</p>'; }).join('');
    var flyv = $('#btn-flyv'), vent = $('#btn-vent');
    vent.disabled = false;
    if (ruteValg) {
      var rs = game.skib(ruteValg.skib), a = ruteValg.a;
      info += '<h3>Ny rute for ' + esc(rs.navn) + '</h3>';
      if (!a) {
        info += '<p>Vælg den første planet på ruten og tryk <b>Vælg</b>.</p>';
        flyv.disabled = !game.adgang(id); $('#btn-flyv-label').textContent = 'Vælg ' + p.navn;
      } else {
        info += '<p>Fra <b>' + esc(pNavn(a)) + '</b> til <b>' + esc(id === a ? '?' : p.navn) + '</b></p>';
        var e = id !== a && game.adgang(id) ? game.ruteEstimat(a, id, rs.type) : null;
        if (e) {
          sti = game.sti(a, id, rs.type).sti;
          info += '<p>Tur-retur ' + dage(e.dage) + ' · <span class="' + RISIKO_CLS[e.risiko] + '">' + RISIKO[e.risiko] + '</span></p>';
          info += '<p class="' + (e.pr_maaned > 0 ? 'ok' : 'fejl') + '">Ca. ' + (e.pr_maaned >= 0 ? '+' : '') + cr(e.pr_maaned) + ' pr. måned ved priserne nu</p>';
          if (e.ud || e.hjem) info += '<p class="muted opt">Ud: ' + (e.ud ? vNavn(e.ud) : 'intet') + ' · hjem: ' + (e.hjem ? vNavn(e.hjem) : 'intet') + '</p>';
        } else info += '<p class="muted">Vælg den anden planet.</p>';
        flyv.disabled = !e; $('#btn-flyv-label').textContent = 'Sæt rute';
      }
      $('#btn-vent-label').textContent = 'Annullér';
    } else {
      $('#btn-vent-label').textContent = 'Vent 1 dag';
      $('#btn-flyv-label').textContent = 'Flyv hertil';
      info += '<h3>' + esc(p.navn) + ' <span class="muted">· ' + fr + '</span></h3>';
      if (id === her) {
        flyv.disabled = true;
        info += '<p class="ok">Du er her. Brændstof koster ' + cr(game.braendstofPris(her)) + ' pr. enhed.</p>';
        info += '<p class="opt">' + esc(planetFakta(id)) + '</p>' + evs;
        var ny = st.nyheder.filter(function (n) { return n.slags === 'nyhed'; });
        if (ny.length && !evs) info += '<p class="muted opt">Nyt: ' + esc(ny[0].tekst) + '</p>';
      } else {
        var ri = game.rejseInfo(id);
        flyv.disabled = !ri.kanFlyve;
        if (ri.grund === 'laast') {
          info += '<p class="fejl">Låst. ' + esc(fNavn(p.fraktion)) + ' lukker dig ind ved ' + p.laast + ' i omdømme (du har ' + st.omdoemme[p.fraktion] + '). Tag kontrakter for dem.</p>';
          info += '<p class="opt">' + esc(planetFakta(id)) + '</p>';
        } else if (ri.grund === 'ingen-vej') {
          info += '<p class="fejl">Der er ingen åben vej herfra.</p>';
        } else {
          sti = ri.sti;
          info += '<p><b class="tal">' + dage(ri.dage) + '</b> (fremme dag ' + ri.ankomst + ') · <span class="' + RISIKO_CLS[ri.risiko] + '">' + RISIKO[ri.risiko] + '</span></p>';
          info += '<p>Brændstof ' + ri.braendstof + (ri.koebBraendstof ? ' – tank ' + ri.koebBraendstof + ' for ' + cr(ri.braendstofPris) : ' – tanken rækker') + '</p>';
          if (ri.lastSalg) info += '<p class="ok">Din last kan sælges der for ca. ' + cr(ri.lastSalg) + '</p>';
          if (ri.forslag) info += '<p class="ok">Køb ' + ri.forslag.antal + ' ' + vNavn(ri.forslag.vare) + ' her: ca. +' + cr(ri.forslag.gevinst) + '</p>';
          else if (!ri.lastSalg) info += '<p class="muted">Ingen vare herfra giver fortjeneste derude lige nu.</p>';
          if (ri.told) info += '<p class="adv">Told ved ankomst: ' + cr(ri.told) + '</p>';
          if (ri.forfaldUndervejs) {
            var r = game.regning();
            info += '<p class="' + (st.kredit - ri.braendstofPris < r.total ? 'fejl' : 'adv') + '">Regningen på ' + cr(r.total) + ' forfalder undervejs (dag ' + game.naesteForfald() + ').</p>';
          }
          if (ri.grund === 'braendstof') info += '<p class="fejl">Du har ikke råd til brændstof nok.</p>';
          info += evs;
        }
      }
    }
    $('#kort-info').innerHTML = info;
    tegnKort(sti);
  }
  function tegnKort(sti) {
    if (!game || current !== 'game' || view !== 'kort') return;
    var svg = $('#kort-svg'), valgt = valgtPlanet || game.her();
    T.kort(svg, { game: game, valgt: valgt, sti: sti, rute: ruteValg });
    // Knapperne over planeterne (til dwell, mus og touch)
    var s = T.punkt(svg, 0, 0).skala;
    var str = Math.max(40, Math.min(14 * s, 150));
    L.PLANETER.forEach(function (p) {
      var b = planetBtns[p.id], pt = T.punkt(svg, p.x, p.y);
      b.style.left = pt.x + 'px'; b.style.top = (pt.y + 1.2 * s) + 'px';
      b.style.width = str + 'px'; b.style.height = str + 'px';
      b.setAttribute('aria-pressed', String(p.id === valgt));
      b.setAttribute('aria-label', p.navn + (game.adgang(p.id) ? '' : ' (låst)') + (p.id === game.her() ? ' (du er her)' : ''));
    });
  }

  function flyvHertil() {
    if (!spilAktivt() || view !== 'kort') return;
    if (ruteValg) { ruteTrin(); return; }
    var id = valgtPlanet; if (!id || id === game.her()) return;
    var ri = game.rejseInfo(id); if (!ri.kanFlyve) { sfx('nej'); return; }
    var r = game.regning();
    if (ri.forfaldUndervejs && game.state.kredit - ri.braendstofPris < r.total) {
      bekraeft({
        titel: 'Flyv alligevel?', ikon: 'flyv', nej: 'Nej, bliv her', ja: 'Ja, flyv',
        tekst: 'Regningen på ' + cr(r.total) + ' forfalder på dag ' + game.naesteForfald() + ', mens du er undervejs, og du har ikke penge nok. Kan du ikke betale, går du konkurs. Sælg lasten først, eller lån på Økonomi-siden.',
        paaJa: function () { flyv(id); }
      });
      return;
    }
    flyv(id);
  }
  function flyv(id) {
    var res = game.flyv(id);
    if (!res.ok) { sfx('nej'); setBesked('Du kan ikke flyve dertil lige nu.', 'fejl'); refresh(); return; }
    sfx('afgang');
    efterRejse(res);
  }
  function efterRejse(res, forTekst) {
    var tekst = forTekst ? [forTekst] : [], cls = 'ok';
    (res.beskeder || []).forEach(function (b) { tekst.push(b.tekst); if (b.slags === 'fejl') cls = 'fejl'; });
    var fremme = !res.moede && !game.state.over && !game.state.rejse;
    efterDage(tekst.join(' '), cls);
    if (fremme) {
      valgtPlanet = null;
      if (cls === 'ok') sfx('ankomst'); else sfx(/Toldkontrol/.test(tekst.join(' ')) ? 'told' : 'nej');
      saveGame();
      if (view === 'kort') { setView('marked'); return; }
    }
    saveGame(); refresh();
  }
  function venDag() {
    if (!spilAktivt()) return;
    if (ruteValg) { ruteValg = null; setBesked('Ruten blev ikke sat.'); refresh(); return; }
    game.vent();
    efterDage('Du venter en dag på ' + pNavn(game.her()) + '.');
    sfx('click'); saveGame(); refresh();
  }
  onAct($('#btn-flyv'), flyvHertil);
  onAct($('#btn-vent'), venDag);

  // Pirater (ingen kamp: betal, flygt eller brug forsikringen)
  function visPirat() {
    var m = game.state.moede; if (!m || current !== 'game') return;
    var st = game.state;
    $('#pirat-tekst').innerHTML = 'Pirater stopper dig mellem <b>' + esc(pNavn(m.fra)) + '</b> og <b>' + esc(pNavn(m.til)) + '</b>. De kræver <b>' + cr(m.krav) + '</b>. ' +
      (m.lastVaerdi ? 'Din last er ' + cr(m.lastVaerdi) + ' værd.' : 'Dit lastrum er tomt.');
    var b = $('[data-pirat="betal"]'), f = $('[data-pirat="flygt"]'), fo = $('[data-pirat="forsikring"]');
    $('.big', b).textContent = 'Betal ' + cr(m.krav);
    b.disabled = st.kredit < m.krav; $('.small', b).textContent = b.disabled ? 'du har kun ' + cr(st.kredit) : 'flyv videre i fred';
    $('.small', f).textContent = Math.round(m.flugt * 100) + ' % chance · ellers mister du halvdelen';
    fo.disabled = !st.forsikring; $('.small', fo).textContent = st.forsikring ? 'de tager lasten, du får 80 %' : 'du har ingen forsikring';
    var ov = $('#pirat-overlay');
    ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
    sfx('pirat');
    (b.disabled ? f : b).focus({ preventScroll: true });
  }
  $$('[data-pirat]').forEach(function (b) {
    onAct(b, function () {
      if (!game || !game.state.moede) return;
      var res = game.pirat(b.dataset.pirat);
      if (!res.ok) { sfx('nej'); return; }
      $('#pirat-overlay').hidden = true; releaseGuard(); dwell.reset();
      sfx(res.valg === 'flygt' ? (res.slap ? 'slap' : 'tab') : res.valg === 'betal' ? 'saelg' : 'tab');
      efterRejse(res.rejse || {}, res.tekst);
    });
  });

  // ---------- Markedet ----------
  var vareBtns = {};
  (function byggVarer() {
    var box = $('#varer');
    L.VARER.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'btn option vare-btn'; b.dataset.vare = v.id;
      b.innerHTML = T.vare(v.id) + '<span class="vare-navn">' + esc(v.navn) + '</span><span class="vare-pris"></span><span class="vare-tag"></span><span class="vare-har"></span>';
      onAct(b, function () { if (!spilAktivt()) return; sfx('click'); valgtVare = v.id; refresh(); });
      box.appendChild(b); vareBtns[v.id] = b;
    });
  })();
  // Bedste sted at sælge en vare (blandt planeter, du har adgang til)
  function bedsteSalg(vare) {
    var her = game.her(), bedst = null;
    L.PLANETER.forEach(function (p) {
      if (p.id === her || !game.adgang(p.id)) return;
      var pr = game.pris(vare, p.id);
      if (pr.forbudt) return;
      if (!bedst || pr.salg > bedst.salg) bedst = { planet: p.id, salg: pr.salg };
    });
    return bedst;
  }
  function syncMarked() {
    var her = game.her(), s = game.flagskib();
    L.VARER.forEach(function (v) {
      var b = vareBtns[v.id], pr = game.pris(v.id, her), har = s.last[v.id] || 0;
      $('.vare-pris', b).innerHTML = '<b>' + tal(pr.koeb) + '</b><span class="lang"> / ' + tal(pr.salg) + '</span>';
      var tag = $('.vare-tag', b), pil = pr.trend > 0 ? ' ↑' : pr.trend < 0 ? ' ↓' : '';
      if (pr.forbudt) { tag.textContent = 'Forbudt'; tag.className = 'vare-tag forbudt'; }
      else { tag.textContent = (pr.niveau === 'billig' ? 'Billig' : pr.niveau === 'dyr' ? 'Dyr' : 'Normal') + pil; tag.className = 'vare-tag ' + pr.niveau; }
      $('.vare-har', b).textContent = har ? har + ' stk' : '';
      b.setAttribute('aria-pressed', String(v.id === valgtVare));
      $('.vare-ill', b).classList.toggle('forbudt', pr.forbudt);
      b.setAttribute('aria-label', v.navn + ': køb ' + pr.koeb + ', sælg ' + pr.salg + (har ? ', du har ' + har : ''));
    });
    var v = valgtVare, pr = game.pris(v, her), har = s.last[v] || 0, plads = game.ledigPlads(s), max = game.maxKoeb(v);
    var info = '<b>' + esc(L.VARE[v].navn) + '</b> på ' + esc(pNavn(her)) + ': køb <span class="kredit-t tal">' + cr(pr.koeb) + '</span>, sælg <span class="tal">' + cr(pr.salg) + '</span>. ';
    if (pr.forbudt) info += '<span class="adv-t">Forbudt her – sælges på det sorte marked.</span> ';
    var bs = bedsteSalg(v);
    if (bs) info += '<span class="opt">Bedst at sælge: ' + esc(pNavn(bs.planet)) + ' (' + cr(bs.salg) + '). </span>';
    if (L.VARE[v].forbudt) info += '<span class="opt adv-t">Smugler du ' + vNavn(v) + ' ind hos ' + esc(fNavn(L.VARE[v].forbudt)) + ', kan tolden tage det. </span>';
    info += '<span class="muted-t">Lastrum: ' + sumLast(s.last) + '/' + L.SKIBSTYPE[s.type].last + '.</span>';
    $('#vare-info').innerHTML = info;
    $$('[data-koeb]').forEach(function (b) {
      var n = b.dataset.koeb === 'max' ? max : Math.min(+b.dataset.koeb, plads);
      var ok = n > 0 && n <= max && (b.dataset.koeb === 'max' || +b.dataset.koeb <= max);
      b.disabled = !ok;
      $('.small', b).textContent = ok ? cr(game.prisFor(her, v, b.dataset.koeb === 'max' ? max : +b.dataset.koeb, true)) + (b.dataset.koeb === 'max' ? ' · ' + max + ' stk' : '') : (plads <= 0 ? 'lastrummet er fuldt' : 'for dyrt');
    });
    $$('[data-saelg]').forEach(function (b) {
      var n = b.dataset.saelg === 'alt' ? har : +b.dataset.saelg;
      var ok = har > 0 && n <= har;
      b.disabled = !ok;
      $('.small', b).textContent = ok ? cr(game.prisFor(her, v, n, false)) + (b.dataset.saelg === 'alt' ? ' · ' + har + ' stk' : '') : (har ? 'du har kun ' + har : 'du har ingen');
    });
  }
  function koeb(n) {
    if (!spilAktivt()) return;
    var r = game.koeb(valgtVare, n);
    if (r.ok) { sfx('koeb'); setBesked('Du købte ' + r.antal + ' ' + vNavn(valgtVare) + ' for ' + cr(r.sum) + '.', 'ok'); }
    else { sfx('nej'); setBesked(r.grund === 'fuld' ? 'Lastrummet er fuldt.' : 'Du har ikke penge nok.', 'fejl'); }
    saveGame(); refresh();
  }
  function saelg(n) {
    if (!spilAktivt()) return;
    var r = game.saelg(valgtVare, n);
    if (r.ok) { sfx('saelg'); setBesked('Du solgte ' + r.antal + ' ' + vNavn(valgtVare) + ' for ' + cr(r.sum) + '.', 'ok'); }
    else { sfx('nej'); setBesked('Du har ingen ' + vNavn(valgtVare) + ' at sælge.', 'fejl'); }
    saveGame(); refresh();
  }
  $$('[data-koeb]').forEach(function (b) { onAct(b, function () { koeb(b.dataset.koeb === 'max' ? 'max' : +b.dataset.koeb); }); });
  $$('[data-saelg]').forEach(function (b) { onAct(b, function () { saelg(b.dataset.saelg === 'alt' ? 'alt' : +b.dataset.saelg); }); });
  function skiftVare(d) {
    var ids = L.VARER.map(function (v) { return v.id; }), i = ids.indexOf(valgtVare);
    valgtVare = ids[(i + d + ids.length) % ids.length]; sfx('click'); refresh();
  }

  // Lister, der aldrig ruller: vis så mange kort, der er plads til, og bladr med Forrige/Næste
  function sider(box, items, fokus) {
    box.innerHTML = '';
    if (!items.length) return { fra: 0, til: 0, n: 0 };
    // Find den side, fokus står på: læg kort i, til der ikke er plads til flere
    var start = 0, slut = 0;
    function fyld(fra) {
      box.innerHTML = '';
      var i = fra;
      for (; i < items.length; i++) {
        box.insertAdjacentHTML('beforeend', items[i]);
        if (box.scrollHeight > box.clientHeight + 1 && i > fra) { box.removeChild(box.lastElementChild); break; }
      }
      return i;
    }
    for (var guard = 0; guard < items.length; guard++) {
      slut = fyld(start);
      if (fokus < slut || slut >= items.length) break;
      start = slut;
    }
    return { fra: start, til: slut, n: items.length };
  }
  function sideTekst(p) { return p.n > p.til - p.fra ? ' (' + (p.fra + 1) + '–' + p.til + ' af ' + p.n + ')' : ''; }

  // ---------- Skibe og ruter ----------
  function skibStatus(s) {
    var st = game.state;
    if (s.id === st.flagskib) return 'Dit flagskib · ' + (s.pos ? 'på ' + pNavn(s.pos) : 'undervejs');
    if (s.rute) {
      var r = s.rute;
      return 'Rute ' + pNavn(r.a) + ' ⇄ ' + pNavn(r.b) + ' · ' + (s.rejse ? 'mod ' + pNavn(s.rejse.til) + ' (' + dage(s.rejse.dage) + ')' : 'på ' + pNavn(s.pos));
    }
    if (s.rejse) return 'Flyver til ' + pNavn(s.rejse.til) + ' (' + dage(s.rejse.dage) + ')';
    return 'Venter på ' + pNavn(s.pos);
  }
  function syncSkibe() {
    var st = game.state;
    if (!game.skib(valgtSkib)) valgtSkib = st.flagskib;
    var idx = 0;
    var items = st.skibe.map(function (s, i) {
      if (s.id === valgtSkib) idx = i;
      var t = L.SKIBSTYPE[s.type];
      var r = s.rute ? '<p class="' + (s.rute.indtaegt >= 0 ? 'ok-t' : 'fejl-t') + '">Rutens resultat: ' + (s.rute.indtaegt >= 0 ? '+' : '') + cr(s.rute.indtaegt) + ' på ' + stk(s.rute.tur, 'tur', 'ture') + '</p>' : '';
      return '<div class="rh-kort' + (s.id === valgtSkib ? ' valgt' : '') + '"><h4>' + T.skib(s.type) + esc(s.navn) + (s.navn.indexOf(t.navn) === 0 ? '' : ' <span class="muted-t">' + esc(t.navn) + '</span>') + '</h4>' +
        '<p>' + esc(skibStatus(s)) + '</p><p class="muted-t">Last ' + sumLast(s.last) + '/' + t.last + ' · brændstof ' + s.braendstof + '/' + t.tank + '</p>' + r + '</div>';
    });
    var p = sider($('#skibsliste'), items, idx);
    var s = game.skib(valgtSkib), flag = s.id === st.flagskib, f = game.flagskib();
    var info = stk(st.skibe.length, 'skib', 'skibe') + sideTekst(p) + '. ';
    if (flag) info += 'Flagskibet flyver du selv. Køb flere skibe og giv dem en rute – så handler de af sig selv hver dag.';
    else if (s.rute) info += esc(s.navn) + ' handler selv mellem ' + esc(pNavn(s.rute.a)) + ' og ' + esc(pNavn(s.rute.b)) + '.';
    else info += esc(s.navn) + ' venter på en rute.';
    $('#skibe-info').innerHTML = info;
    $('#btn-ny-rute').disabled = flag;
    $('#btn-stop-rute').disabled = flag || !s.rute;
    $('#btn-flagskib').disabled = flag || s.pos !== f.pos || !!s.rejse || !!s.rute;
    $('#btn-koeb-skib').disabled = st.skibe.length >= L.MAX_SKIBE;
    $('#btn-forrige-skib').disabled = $('#btn-naeste-skib').disabled = st.skibe.length < 2;
  }
  function vaelgSkib(id) { valgtSkib = id; refresh(); }
  function skiftSkib(d) {
    var sk = game.state.skibe, i = 0;
    sk.forEach(function (s, j) { if (s.id === valgtSkib) i = j; });
    valgtSkib = sk[(i + d + sk.length) % sk.length].id; sfx('click'); refresh();
  }
  onAct($('#btn-forrige-skib'), function () { if (spilAktivt()) skiftSkib(-1); });
  onAct($('#btn-naeste-skib'), function () { if (spilAktivt()) skiftSkib(1); });
  onAct($('#btn-ny-rute'), function () {
    if (!spilAktivt()) return;
    var s = game.skib(valgtSkib); if (!s || s.id === game.state.flagskib) return;
    sfx('click');
    ruteValg = { skib: s.id, a: null };
    valgtPlanet = s.pos || (s.rejse && s.rejse.til) || game.her();
    setBesked('Vælg to planeter på kortet til ' + s.navn + 's rute.');
    view = 'kort'; layoutGame(); guardUnderGaze($('#v-kort'));
  });
  function ruteTrin() {
    var id = valgtPlanet || game.her();
    if (!game.adgang(id)) { sfx('nej'); return; }
    if (!ruteValg.a) { ruteValg.a = id; sfx('click'); refresh(); return; }
    if (id === ruteValg.a) { sfx('nej'); return; }
    var s = game.skib(ruteValg.skib), r = game.saetRute(s.id, ruteValg.a, id);
    if (r.ok) { sfx('ok'); setBesked(s.navn + ' flyver nu fast mellem ' + pNavn(ruteValg.a) + ' og ' + pNavn(id) + '.', 'ok'); }
    else { sfx('nej'); setBesked('Ruten kunne ikke sættes.', 'fejl'); }
    ruteValg = null; valgtSkib = s.id; saveGame();
    setView('skibe');
  }
  onAct($('#btn-stop-rute'), function () {
    if (!spilAktivt()) return;
    var s = game.skib(valgtSkib); if (!s || !s.rute) return;
    game.stopRute(s.id); sfx('click');
    setBesked(s.navn + ' stopper efter denne tur og venter på næste planet.');
    saveGame(); refresh();
  });
  onAct($('#btn-flagskib'), function () {
    if (!spilAktivt()) return;
    var s = game.skib(valgtSkib), r = game.goerFlagskib(valgtSkib);
    if (r.ok) { sfx('ok'); setBesked('Du flyver nu ' + s.navn + '. Lasten er flyttet over, så vidt der var plads.', 'ok'); }
    else { sfx('nej'); setBesked('Skibet skal være på samme planet som dig og uden rute.', 'fejl'); }
    saveGame(); refresh();
  });
  onAct($('#btn-koeb-skib'), function () {
    if (!spilAktivt()) return;
    sfx('click');
    var st = game.state;
    $('#skib-tekst').textContent = 'Skibet bygges på ' + pNavn(game.her()) + '. Du har ' + cr(st.kredit) + ' og ' + stk(st.skibe.length, 'skib', 'skibe') + ' (højst ' + L.MAX_SKIBE + '). Hvert ekstra skib koster drift på månedens regning.';
    $$('[data-skibtype]').forEach(function (b) {
      var t = L.SKIBSTYPE[b.dataset.skibtype];
      b.disabled = st.kredit < t.pris;
      $('.small', b).textContent = cr(t.pris) + ' · last ' + t.last + ' · tank ' + t.tank;
    });
    var ov = $('#skib-overlay');
    ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
    $('#btn-skib-luk').focus({ preventScroll: true });
  });
  $$('[data-skibtype]').forEach(function (b) {
    onAct(b, function () {
      var r = game.koebSkib(b.dataset.skibtype);
      $('#skib-overlay').hidden = true; releaseGuard(); dwell.reset();
      if (r.ok) { sfx('koeb'); valgtSkib = r.skib.id; setBesked('Du købte ' + r.skib.navn + '. Giv det en rute med "Ny rute".', 'ok'); }
      else { sfx('nej'); setBesked(r.grund === 'max' ? 'Du har allerede ' + L.MAX_SKIBE + ' skibe.' : 'Du har ikke penge nok.', 'fejl'); }
      saveGame(); refresh();
    });
  });
  $('#btn-skib-luk').addEventListener('click', function () { sfx('click'); $('#skib-overlay').hidden = true; releaseGuard(); dwell.reset(); refresh(); });

  // ---------- Bygninger ----------
  function bygTekst(pid, b) {
    var p = L.PLANET[pid], d = [];
    if (b.mine) d.push('mine (' + L.BYGNINGER.mine.pr_dag + ' ' + vNavn(p.mine) + '/dag)');
    if (b.fabrik) d.push('fabrik (' + vNavn(p.fabrik.ind) + ' → ' + vNavn(p.fabrik.ud) + ')');
    if (b.lager) d.push(stk(b.lager, 'lager', 'lagre'));
    return d.length ? liste(d) : 'ingenting';
  }
  function syncBygninger() {
    var st = game.state, her = game.her(), p = L.PLANET[her], b = st.bygninger[her];
    var kan = [];
    if (p.mine) kan.push('en mine, der graver ' + vNavn(p.mine) + ' op');
    if (p.fabrik) kan.push('en fabrik, der laver ' + vNavn(p.fabrik.ind) + ' om til ' + vNavn(p.fabrik.ud));
    var her_t = '<h4>' + T.ikon('bygninger') + esc(p.navn) + '</h4><p>' + (kan.length ? 'Her kan du bygge ' + liste(kan) + '. ' : 'Her er hverken mine eller fabrik, men du kan bygge lagre. ') +
      '<span class="opt">Varerne samles på dit lager – er det fuldt, sælges resten automatisk.</span></p>';
    if (b) {
      var plads = game.lagerPlads(b), har = sumLast(b.varer || {});
      her_t += '<p>Du har ' + bygTekst(her, b) + '. Lager ' + har + '/' + plads + ': ' + esc(lastTekst(b.varer || {})) + '.</p>';
    }
    $('#byg-her').className = 'byg-her rh-kort';
    $('#byg-her').innerHTML = her_t;
    var ids = Object.keys(st.bygninger).filter(function (k) { return k !== her; });
    var items = ids.map(function (k) {
      var bb = st.bygninger[k];
      return '<div class="rh-kort"><h4>' + T.ikon('bygninger') + esc(pNavn(k)) + '</h4><p>' + esc(bygTekst(k, bb)) + '</p><p class="muted-t">Lager ' + sumLast(bb.varer || {}) + '/' + game.lagerPlads(bb) + ': ' + esc(lastTekst(bb.varer || {})) + '</p></div>';
    });
    var pr = Math.max(1, 1);
    var pg = sider($('#bygliste'), items, bygSide);
    if (bygSide >= items.length) bygSide = Math.max(0, items.length - 1);
    $('#btn-byg-forrige').disabled = pg.fra <= 0;
    $('#btn-byg-naeste').disabled = pg.til >= pg.n;
    $('#bygliste').dataset.fra = pg.fra; $('#bygliste').dataset.til = pg.til;
    $$('[data-byg]').forEach(function (btn) {
      var t = btn.dataset.byg, ok = game.kanBygge(t, her), pris = game.bygPris(t);
      btn.disabled = !ok || st.kredit < pris;
      $('.small', btn).textContent = !ok ? (t === 'lager' ? 'højst ' + L.BYGNINGER.lager.max : (t === 'mine' ? (p.mine ? 'bygget' : 'ikke her') : (p.fabrik ? 'bygget' : 'ikke her'))) :
        cr(pris);
    });
    var hent = $('#btn-hent'), lagerHer = b ? sumLast(b.varer || {}) : 0, plads = game.ledigPlads(game.flagskib());
    hent.disabled = !lagerHer || plads <= 0;
    $('.small', hent).textContent = !lagerHer ? 'tomt' : plads <= 0 ? 'lasten er fuld' : Math.min(lagerHer, plads) + ' stk';
    void pr;
  }
  $$('[data-byg]').forEach(function (b) {
    onAct(b, function () {
      if (!spilAktivt()) return;
      var t = b.dataset.byg, pris = game.bygPris(t), navn = L.BYGNINGER[t].navn.toLowerCase();
      bekraeft({
        titel: 'Byg ' + navn + '?', ikon: t, nej: 'Nej', ja: 'Ja, byg',
        tekst: 'En ' + navn + ' på ' + pNavn(game.her()) + ' koster ' + cr(pris) + ' og ' + cr(L.BYGNINGER[t].drift) + ' i drift på hver måneds regning.',
        paaJa: function () {
          var r = game.byg(t);
          if (r.ok) { sfx('ok'); setBesked('Du byggede ' + navn + ' på ' + pNavn(game.her()) + '.', 'ok'); }
          else { sfx('nej'); setBesked('Det kan ikke bygges her lige nu.', 'fejl'); }
          saveGame(); refresh();
        }
      });
    });
  });
  onAct($('#btn-hent'), function () {
    if (!spilAktivt()) return;
    var r = game.hentLager();
    if (r.ok) { sfx('koeb'); setBesked('Du hentede ' + r.antal + ' stk fra lageret.', 'ok'); }
    else { sfx('nej'); setBesked(r.grund === 'fuld' ? 'Lastrummet er fuldt.' : 'Lageret er tomt.', 'fejl'); }
    saveGame(); refresh();
  });
  onAct($('#btn-byg-forrige'), function () { if (!spilAktivt()) return; sfx('click'); var el = $('#bygliste'); bygSide = Math.max(0, (+el.dataset.fra || 0) - 1); refresh(); });
  onAct($('#btn-byg-naeste'), function () { if (!spilAktivt()) return; sfx('click'); bygSide = +$('#bygliste').dataset.til || 0; refresh(); });

  // ---------- Kontrakter og omdømme ----------
  function kontrakter() { return kListe === 'tilbud' ? game.tilbud() : game.state.kontrakter; }
  function syncKontrakter() {
    var st = game.state, liste_ = kontrakter();
    if (kValg >= liste_.length) kValg = Math.max(0, liste_.length - 1);
    var items = liste_.map(function (k, i) {
      var har = game.flagskib().last[k.vare] || 0, frist = k.frist - st.dag;
      return '<div class="rh-kort' + (i === kValg ? ' valgt' : '') + '"><h4>' + T.vare(k.vare) + tal(k.antal) + ' ' + esc(vNavn(k.vare)) + ' → ' + esc(pNavn(k.til)) + '</h4>' +
        '<p><span class="fr-' + k.fraktion + '">' + esc(fNavn(k.fraktion)) + '</span> · <span class="kredit-t">' + cr(k.betaling) + '</span> · +' + k.rep + ' omdømme</p>' +
        '<p class="' + (frist <= 5 ? 'fejl-t' : 'muted-t') + '">Frist dag ' + k.frist + ' (om ' + dage(frist) + ')' + (kListe === 'dine' ? ' · du har ' + har : '') + '</p></div>';
    });
    var box = $('#kontraktliste');
    var pg = sider(box, items, kValg);
    if (!items.length) box.innerHTML = '<p class="info muted-t">' + (kListe === 'tilbud' ? 'Ingen tilbud på ' + esc(pNavn(game.her())) + ' lige nu. Nye tilbud kommer, når du har været væk i 10 dage.' : 'Du har ingen kontrakter. Tag op til 3 fra tilbuddene.') + '</p>';
    $('#omdoemme').innerHTML = L.FRAKTIONER.map(function (f) {
      var o = st.omdoemme[f.id];
      return '<div class="rep"><div class="rep-navn fr-' + f.id + '">' + esc(f.navn) + ' ' + o + '</div><div class="rep-bar"><span style="width:' + o + '%"></span><i style="left:' + L.ADGANG + '%"></i><i style="left:' + L.TOLDFRI + '%"></i></div>' +
        '<div class="rep-tekst">' + (o >= L.TOLDFRI ? 'Toldfri · ' : 'Told ' + Math.round(f.told * 100) + ' % · ') + 'rabat ' + Math.round(Math.min(10, o / 10)) + ' %</div></div>';
    }).join('');
    $$('[data-kliste]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kliste === kListe)); });
    $('#btn-forrige-k').disabled = kValg <= 0;
    $('#btn-naeste-k').disabled = kValg >= liste_.length - 1;
    var k = liste_[kValg], h = $('#btn-k-handling');
    if (kListe === 'tilbud') {
      $('#btn-k-label').textContent = k ? 'Tag kontrakt' + sideTekst(pg) : 'Ingen tilbud';
      h.disabled = !k || st.kontrakter.length >= 3;
      if (k && st.kontrakter.length >= 3) $('#btn-k-label').textContent = 'Du har allerede 3';
    } else {
      var kan = k && game.kanLevere(k.id);
      $('#btn-k-label').textContent = !k ? 'Ingen kontrakter' : kan ? 'Lever' : 'Lever på ' + pNavn(k.til);
      h.disabled = !kan;
    }
  }
  function setKListe(l) { kListe = l; kValg = 0; refresh(); }
  $$('[data-kliste]').forEach(function (b) { onAct(b, function () { if (!spilAktivt()) return; sfx('click'); setKListe(b.dataset.kliste); }); });
  onAct($('#btn-forrige-k'), function () { if (!spilAktivt()) return; sfx('click'); kValg = Math.max(0, kValg - 1); refresh(); });
  onAct($('#btn-naeste-k'), function () { if (!spilAktivt()) return; sfx('click'); kValg = Math.min(kontrakter().length - 1, kValg + 1); refresh(); });
  function kHandling() {
    if (!spilAktivt()) return;
    var k = kontrakter()[kValg]; if (!k) return;
    if (kListe === 'tilbud') {
      var r = game.tagKontrakt(k.id);
      if (r.ok) { sfx('ok'); setBesked('Kontrakt taget: ' + k.antal + ' ' + vNavn(k.vare) + ' til ' + pNavn(k.til) + ' senest dag ' + k.frist + '.', 'ok'); }
      else { sfx('nej'); setBesked('Du kan højst have 3 kontrakter ad gangen.', 'fejl'); }
    } else {
      var l = game.lever(k.id);
      if (l.ok) {
        sfx('kontrakt');
        setBesked('Leveret! +' + cr(l.betaling) + ' og +' + l.rep + ' omdømme.' + (l.aabnet.length ? ' Nu kan du flyve til ' + liste(l.aabnet.map(pNavn)) + '.' : ''), 'ok');
      } else { sfx('nej'); setBesked('Du skal være på ' + pNavn(k.til) + ' med ' + k.antal + ' ' + vNavn(k.vare) + '.', 'fejl'); }
    }
    saveGame(); refresh();
  }
  onAct($('#btn-k-handling'), kHandling);

  // ---------- Økonomi ----------
  function syncGaeld() {
    var st = game.state, r = game.regning(), nf = game.naesteForfald();
    var rk = function (n, v) { return '<tr><td>' + n + '</td><td>' + cr(v) + '</td></tr>'; };
    var html = '<div class="rh-kort"><h4>' + T.ikon('forfald') + 'Regning dag ' + nf + ' (om ' + dage(nf - st.dag) + ')</h4><table>' +
      rk('Renter (' + Math.round(L.RENTE * 100) + ' %)', r.renter) + rk('Afdrag', r.afdrag) + rk('Licens', r.licens) + (r.drift ? rk('Drift', r.drift) : '') + (r.forsikring ? rk('Forsikring', r.forsikring) : '') +
      '<tr class="sum"><td>I alt</td><td>' + cr(r.total) + '</td></tr></table>' +
      '<p class="' + (st.kredit < r.total ? 'fejl-t' : 'ok-t') + '">' + (st.kredit < r.total ? 'Du mangler ' + cr(r.total - st.kredit) + '!' : 'Du har råd.') + '</p></div>';
    html += '<div class="rh-kort"><h4>' + T.ikon('gaeld') + 'Lån</h4><p>Gæld ' + cr(st.gaeld) + ' · højst ' + cr(L.LAAN_MAX) + '</p><p class="muted-t forkl">Licensen vokser hver måned. Afdrag mindsker renterne.</p></div>';
    var forsk = (function () { var g = st.forsikring; st.forsikring = true; var x = game.regning().forsikring; st.forsikring = g; return x; })();
    html += '<div class="rh-kort"><h4>' + T.ikon('forsikring') + 'Forsikring</h4><p>' + (st.forsikring ? 'Slået til' : 'Slået fra') + ' · ' + cr(forsk) + '/md</p><p class="muted-t forkl">Dækker 80 % af lasten, hvis pirater tager den.</p></div>';
    html += '<div class="rh-kort"><h4>' + T.ikon('kredit') + 'Formue</h4><p>Nettoformue ' + cr(game.nettoformue()) + '</p><p class="kredit-t">Point nu: ' + tal(game.point()) + '</p></div>';
    $('#regning').innerHTML = html;
    var b1 = $('#btn-betal'), ba = $('#btn-betal-alt'), bl = $('#btn-laan'), bf = $('#btn-forsikring');
    b1.disabled = st.gaeld <= 0 || st.kredit < Math.min(1000, st.gaeld);
    var alt = Math.min(st.gaeld, Math.floor(st.kredit));
    ba.disabled = alt <= 0;
    $('.big', ba).textContent = alt >= st.gaeld && alt > 0 ? 'Betal alt' : 'Betal ' + tal(alt);
    $('.small', ba).textContent = st.gaeld <= 0 ? 'ingen gæld' : alt >= st.gaeld ? cr(st.gaeld) : 'alt du har';
    bl.disabled = st.gaeld + L.LAAN_TRIN > L.LAAN_MAX;
    $('.big', bl).textContent = 'Lån ' + tal(L.LAAN_TRIN);
    $('.small', bl).textContent = bl.disabled ? 'lånet er maks' : Math.round(L.RENTE * 100) + ' % pr. md';
    bf.setAttribute('aria-pressed', String(st.forsikring));
    $('.small', bf).textContent = (st.forsikring ? 'til · ' : 'fra · ') + tal(forsk) + '/md';
  }
  onAct($('#btn-betal'), function () {
    if (!spilAktivt()) return;
    var r = game.betalAf(1000);
    if (r.ok) { sfx('regning'); setBesked('Du betalte ' + cr(r.beloeb) + ' af på lånet.', 'ok'); } else sfx('nej');
    saveGame(); refresh();
  });
  onAct($('#btn-betal-alt'), function () {
    if (!spilAktivt()) return;
    var st = game.state, n = Math.min(st.gaeld, Math.floor(st.kredit));
    if (n <= 0) return;
    bekraeft({
      titel: 'Betal ' + cr(n) + '?', ikon: 'betal', nej: 'Nej', ja: 'Ja, betal',
      tekst: 'Du betaler ' + cr(n) + ' af på lånet' + (n < st.gaeld ? ' og har 0 cr tilbage' : '') + '. Husk, at regningen på ' + cr(game.regning().total) + ' forfalder dag ' + game.naesteForfald() + '.',
      paaJa: function () { var r = game.betalAf('alt'); if (r.ok) { sfx('regning'); setBesked('Du betalte ' + cr(r.beloeb) + ' af på lånet.', 'ok'); } saveGame(); refresh(); }
    });
  });
  onAct($('#btn-laan'), function () {
    if (!spilAktivt()) return;
    var r = game.laan();
    if (r.ok) { sfx('saelg'); setBesked('Du lånte ' + cr(r.beloeb) + '. Det giver mere i renter.', 'ok'); } else sfx('nej');
    saveGame(); refresh();
  });
  onAct($('#btn-forsikring'), function () {
    if (!spilAktivt()) return;
    game.saetForsikring(!game.state.forsikring); sfx('click');
    setBesked(game.state.forsikring ? 'Forsikringen er slået til.' : 'Forsikringen er slået fra.');
    saveGame(); refresh();
  });

  // ---------- Slut ----------
  function slutSpil() {
    var st = game.state;
    if (!st.over || slutVist) return;
    slutVist = true;
    var point = game.point();
    var rank = records.add('point', point, { dage: st.dag, grund: st.grund, skibe: st.skibe.length }).rank;
    saveGame();
    var konkurs = st.grund === 'konkurs';
    $('#slut-kicker').textContent = konkurs ? 'Konkurs' : 'Du gik på pension';
    $('#slut-title').textContent = tal(point) + ' point';
    $('#slut-grund').textContent = GRUND[st.grund] + (konkurs && st.manglede ? ' Du manglede ' + cr(st.manglede) + '.' : '');
    $('#slut-tal').textContent = stk(st.dag, 'dag', 'dage') + ' · ' + stk(st.skibe.length, 'skib', 'skibe') + ' · ' + stk(game.antalBygninger(), 'bygning', 'bygninger') + ' · ' +
      stk(st.stat.kontrakter, 'kontrakt', 'kontrakter') + ' leveret. Point er den største nettoformue, du nåede.';
    $('#slut-rank').textContent = rank ? (rank === 1 ? 'Ny rekord! Nummer 1 på listen.' : 'Nummer ' + rank + ' på top 10.') : '';
    hideOverlays();
    var ov = $('#slut-overlay');
    ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
    sfx(konkurs ? 'konkurs' : 'pension');
    $('#btn-slut-ny').focus({ preventScroll: true });
  }
  $('#btn-slut-ny').addEventListener('click', function () { sfx('click'); nyHandel(); });
  $('#btn-slut-menu').addEventListener('click', function () { sfx('click'); hideOverlays(); show('menu'); });
  $('#btn-slut-rekorder').addEventListener('click', function () { sfx('click'); hideOverlays(); openRecords('menu'); });

  // ---------- Pause ----------
  function setPaused(p) {
    if (!game || game.state.over) return;
    paused = p;
    var ov = $('#pause-overlay');
    ov.hidden = !p;
    var pen = $('#btn-pension'), kan = !game.state.moede;
    pen.disabled = !kan;
    $('.small', pen).textContent = kan ? 'point nu: ' + tal(Math.max(game.point(), game.nettoformue())) : 'ikke under et pirat-møde';
    if (p) { fitScreen(ov); dwell.reset(); guardUnderGaze(ov); $('#btn-resume').focus({ preventScroll: true }); sfx('click'); }
    else { releaseGuard(); dwell.reset(); guardUnderGaze($('#game')); refresh(); }
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(true); });
  $('#btn-resume').addEventListener('click', function () { sfx('click'); setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-pause-menu').addEventListener('click', function () { sfx('click'); saveGame(); hideOverlays(); show('menu'); });
  $('#btn-pension').addEventListener('click', function () {
    if (!game || game.state.over || game.state.moede) return;
    sfx('click');
    var n = game.nettoformue();
    bekraeft({
      titel: 'Gå på pension?', ikon: 'pension', nej: 'Nej, handl videre', ja: 'Ja, gå på pension',
      tekst: 'Spillet slutter, og du får ' + tal(Math.max(game.point(), n)) + ' point (den største nettoformue, du har nået). Din nettoformue er nu ' + cr(n) + '.',
      paaJa: function () { hideOverlays(); game.pension(); saveGame(); slutSpil(); }
    });
  });

  // ---------- Rekorder ----------
  var recordsReturn = 'menu';
  function openRecords(from) { recordsReturn = from || 'menu'; syncRecords(); show('records'); }
  var GRUND_KORT = { konkurs: 'konkurs', pension: 'pension' };
  function syncRecords() {
    var ol = $('#rec-list'), list = records.list('point');
    ol.innerHTML = '';
    for (var i = 0; i < records.max; i++) {
      var li = document.createElement('li'), e = list[i];
      if (e) {
        li.innerHTML = '<span class="score"></span><span class="date"></span>';
        var sc = li.querySelector('.score');
        sc.appendChild(document.createTextNode(tal(e.score) + ' point'));
        var x = document.createElement('span'); x.className = 'plates';
        x.textContent = ' · ' + stk(e.dage || 0, 'dag', 'dage') + (e.grund ? ' · ' + (GRUND_KORT[e.grund] || '') : '');
        sc.appendChild(x);
        li.querySelector('.date').textContent = ArkadeHighscores.formatDate(e.date);
      } else li.innerHTML = '<span class="score muted">–</span><span class="date"></span>';
      ol.appendChild(li);
    }
  }
  $('#btn-records-back').addEventListener('click', function () { sfx('click'); show(recordsReturn); });

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
    arkade.set('dwellTime', v); sfx('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  $('#btn-settings-back').addEventListener('click', function () {
    sfx('click');
    if (settingsReturn === 'game' && game && !game.state.over) { show('game'); setPaused(true); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // 1–6 skifter side. Kortet: pilene vælger planet, Enter flyver (eller vælger i rute-valg), V venter.
  // Markedet: pilene vælger vare, K køber 1 (Skift: 5), S sælger 1 (Skift: 5).
  // Skibe/kontrakter/bygninger: pilene bladrer, Enter tager/leverer. Esc eller P = pause.
  var FANER = ['kort', 'marked', 'skibe', 'bygninger', 'kontrakter', 'gaeld'];
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (bekraeftOpen()) { if (e.key === 'Escape') { e.preventDefault(); $('#btn-bekraeft-nej').click(); } return; }
    if (current !== 'game' || !game) return;
    if (!$('#skib-overlay').hidden) { if (e.key === 'Escape') { e.preventDefault(); $('#btn-skib-luk').click(); } return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (game.state.over || game.state.moede) return;
      e.preventDefault(); setPaused(!paused); return;
    }
    if (overlayOpen() || game.state.over) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, handled = true;
    var frem = k === 'ArrowRight' || k === 'ArrowDown', tilbage = k === 'ArrowLeft' || k === 'ArrowUp';
    var paaKrop = document.activeElement === document.body || !document.activeElement;
    if (e.repeat && !frem && !tilbage) return;
    if (/^[1-6]$/.test(k)) { sfx('click'); setView(FANER[+k - 1]); }
    else if (k === 'v' && view === 'kort') venDag();
    else if (view === 'kort' && (frem || tilbage)) { sfx('click'); skiftPlanet(frem ? 1 : -1); }
    else if (view === 'kort' && k === 'Enter' && paaKrop) { if (!$('#btn-flyv').disabled) flyvHertil(); }
    else if (view === 'marked' && (frem || tilbage)) skiftVare(frem ? 1 : -1);
    else if (view === 'marked' && k === 'k') koeb(e.shiftKey ? 5 : 1);
    else if (view === 'marked' && k === 's') saelg(e.shiftKey ? 5 : 1);
    else if (view === 'skibe' && (frem || tilbage)) skiftSkib(frem ? 1 : -1);
    else if (view === 'kontrakter' && (frem || tilbage)) { sfx('click'); kValg = Math.max(0, Math.min(kontrakter().length - 1, kValg + (frem ? 1 : -1))); refresh(); }
    else if (view === 'kontrakter' && k === 'Enter' && paaKrop) kHandling();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
  });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  var gameEl = $('#game');
  function gameOverflow() {
    var vEl = $('#v-' + view);
    if (overflows(gameEl) || overflows($('#spil'))) return true;
    if (vEl && (overflows(vEl) || $$('.vis, .side, .side .info, .knapper, .varer, .kortliste', vEl).some(overflows))) return true;
    if (overflows($('.faner')) || overflows($('#hud'))) return true;
    return btnOverflow();
  }
  function btnOverflow() {
    return $$('#spil .btn:not(.planet-btn)').some(function (b) { return b.offsetParent && (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2); });
  }
  function applyGame(b, v) {
    var land = v.W >= v.H * 1.1, lav = land && v.H < 600, mn = Math.min(v.W, v.H);
    var pad = Math.max(8, Math.round(mn * 0.014)), ig = Math.max(8, Math.min(16, Math.round(mn * 0.012)));
    var inner = v.W - 2 * pad;
    gameEl.classList.toggle('lay-bred', land && !lav); gameEl.classList.toggle('lay-lav', lav); gameEl.classList.toggle('lay-hoej', !land);
    gameEl.classList.toggle('smal', !land && v.W < 600);
    var st = gameEl.style;
    st.setProperty('--btn', b + 'px'); st.setProperty('--pad', pad + 'px'); st.setProperty('--ig', ig + 'px');
    st.setProperty('--fane-h', Math.round(Math.max(SMALL_MIN, b * (land ? 0.72 : (v.W < 600 ? 0.76 : 0.9)))) + 'px');
    st.setProperty('--fane-kol', inner >= 6 * Math.max(SMALL_MIN * 1.25, b) + 5 * ig ? 6 : 3);
    var rest = lav ? inner - 2.3 * b - ig : inner;
    var sw = Math.round(Math.max((lav ? 2.4 : 2) * b + ig, Math.min(rest * 0.34, 2.9 * b + ig)));
    st.setProperty('--side-w', sw + 'px');
  }
  function layoutGame() {
    if (current !== 'game') return;
    var v = viewport(), small = isSmall(v), floor = SMALL_MIN;
    var b = Math.max(floor, cssBtn(v.W, v.H));
    var spil = $('#spil');
    root.classList.toggle('rh-lille', small);
    spil.style.zoom = ''; gameEl.classList.remove('tight');
    applyGame(b, v);
    if (game) refresh();
    for (var i = 0; i < 16 && gameOverflow() && b > floor; i++) { b = Math.max(floor, b * 0.94); applyGame(b, v); if (game) refresh(); }
    if (gameOverflow()) { gameEl.classList.add('tight'); if (game) refresh(); }
    var z = 1;
    for (var j = 0; j < 8 && gameOverflow(); j++) {
      var r = Math.min(0.97, gameEl.clientHeight / gameEl.scrollHeight, gameEl.clientWidth / gameEl.scrollWidth);
      var vEl = $('#v-' + view);
      if (vEl && vEl.scrollHeight) r = Math.min(r, vEl.clientHeight / vEl.scrollHeight, vEl.clientWidth / vEl.scrollWidth);
      z = Math.max(0.5, z * r); spil.style.zoom = String(z);
      if (game) refresh();
    }
    gameEl.dataset.btn = Math.round(b);
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('rh-lille', small);
    root.classList.toggle('rh-tvaers', small && v.W > v.H);
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
      var host = (o.navBottom && !root.classList.contains('rh-tvaers')) ? o.navBottom : o.navIn;
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
  // 1) mindre knapper og afstande (aldrig under SMALL_MIN), 2) valgfri tekst skjules,
  // 3) indholdet deles på flere sider, 4) zoom som nødløsning.
  function fitScreen(el, resetPage) {
    if (!el || el.hidden) return;
    var v = viewport(), gap = cssGap(v.W, v.H);
    var isOverlay = el.classList.contains('overlay');
    var target = isOverlay ? el.querySelector('.panel') : el;
    var box = el, pager = pagers[el.id];
    target.style.zoom = '';
    el.style.removeProperty('--btn'); el.style.removeProperty('--gap');
    el.classList.remove('tight');
    if (el.id === 'menu') el.classList.remove('hall-inflow');
    var keepPage = !resetPage && pager && pager.pages > 1;
    if (pager) pager.reset();
    var base = cssBtn(v.W, v.H), minB = SMALL_MIN;
    el.style.setProperty('--btn', base + 'px');
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('rh-tvaers')) {
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
    syncSmall();
    if (current === 'game') layoutGame(); else fitScreen($('#' + current));
    $$('#' + current + ' .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    if (bekraeftOpen()) fitScreen($('#bekraeft-overlay'));
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    fitCurrent();
    clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCurrent, 150);
  });
  window.addEventListener('pagehide', saveGame);

  // ---------- Start ----------
  T.installer();
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Rumhandleren = {
    get game() { return game; }, get view() { return view; }, get paused() { return paused; },
    get besked() { return besked.tekst; }, get valgtPlanet() { return valgtPlanet; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    nyHandel: nyHandel, show: show, setView: setView, vaelgPlanet: vaelgPlanet, flyv: flyvHertil, vent: venDag,
    layout: layoutGame, refresh: refresh, setPaused: setPaused,
    vaelgVare: function (id) { valgtVare = id; refresh(); }, vaelgSkib: vaelgSkib, setKListe: setKListe,
    koeb: koeb, saelg: saelg,
    setState: function (st, v) {
      game = L.createGame(st); nulstilValg(); view = v || 'kort';
      hideOverlays(); show('game'); refresh();
    },
    save: saveGame
  };
})();
