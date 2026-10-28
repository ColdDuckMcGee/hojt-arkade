/*
 * Kaperen – app.js: skærme, knapper, layout, dwell, tastatur, indstillinger,
 * rekorder og gem. Spillets regler ligger i js/logik.js (kender ingen farver),
 * tegningerne i js/tegn.js og grafikken i tema/<navn>/.
 *
 * Alt er turbaseret: intet sker, før spilleren vælger.
 */
(function () {
  'use strict';

  var $ = function (sel, r) { return (r || document).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var L = window.KaperenLogik, T = window.KaperenTegn;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  var gset = ArkadeSettings.create('kaperen', { gloed: true });
  var records = ArkadeHighscores.create('kaperen', { max: 10 });
  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Rejsen, der er i gang ----------
  var SAVE_KEY = 'hojtArkade.kaperen.spil';
  function loadGame() {
    try { var raw = localStorage.getItem(SAVE_KEY); var g = raw ? JSON.parse(raw) : null; return g && !g.over && g.havn && g.skib ? g : null; } catch (e) { return null; }
  }
  function saveGame() {
    try {
      if (game && !game.state.over) localStorage.setItem(SAVE_KEY, JSON.stringify(game.save()));
      else localStorage.removeItem(SAVE_KEY);
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
  function swallowed(el) { if (suppress === el) { suppress = null; return true; } return false; }
  function onAct(el, fn) { el.addEventListener('click', function (e) { if (!swallowed(el)) fn(e); }); }

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  function volumeSetting() {
    var v = arkade.all().volume;
    if (typeof v !== 'number' || isNaN(v)) return 1;
    return v > 1 ? v / 100 : v;
  }
  var lyd = KaperenLyd.create({ sfx: arkade.get('sound'), volume: volumeSetting() });
  function sfx(name, delay) { if (name === 'click') audio.play('click'); else lyd.play(name, delay); }
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
    root.classList.toggle('kap-stille', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden og skibet, der sejler på kortet';
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
  function applyGlow() { root.setAttribute('data-kap-gloed', gset.get('gloed') ? 'til' : 'fra'); }
  gset.onChange(function (key) { if (key === 'gloed') applyGlow(); syncSettingsUi(); });

  // ---------- Tekster ----------
  function tal(n) { n = Math.round(n); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '−' : '') + s; }
  function guld(n) { return tal(n) + ' guld'; }
  function stk(n, ental, flertal) { return tal(n) + ' ' + (n === 1 ? ental : flertal); }
  function havnNavn(id) { var h = L.havnById(id); return h ? h.navn : ''; }
  function vareNavn(id) { var v = L.vareById(id); return v ? v.navn.toLowerCase() : id; }
  function skibNavn(id) { return L.skibById(id).navn.toLowerCase(); }
  function liste(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' og ' + arr[arr.length - 1]; }
  function lastTekst(last) {
    var dele = [];
    L.VARER.forEach(function (v) { if (last && last[v.id]) dele.push(last[v.id] + ' ' + v.navn.toLowerCase()); });
    return liste(dele);
  }
  var AFSTAND = ['Langs siden', 'Tæt på', 'På skudhold', 'Langt væk', 'Væk'];
  var GRUND = {
    sunket: 'Dit skib sank i kampen.',
    taget: 'Marinen entrede dit skib og tog dig til fange.',
    storm: 'Stormen knuste dit skib.',
    sult: 'Proviantet slap op, og mandskabet sultede.',
    mandskab: 'Du mistede hele dit mandskab.',
    land: 'Du gik i land med din formue.'
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
      $('#btn-start-label').textContent = 'Fortsæt rejsen';
      $('#btn-start-sub').textContent = 'Dag ' + gemt.dag + ' · ' + havnNavn(gemt.havn) + ' · ' + guld(gemt.guld);
    } else {
      $('#btn-start-label').textContent = 'Ny rejse';
      $('#btn-start-sub').textContent = 'En lille slup og ' + guld(L.START.guld);
    }
    $('#btn-ny').hidden = !gemt;
    T.skibBillede($('#menu-skib'), gemt ? gemt.skib : 'brig');
    if (current === 'menu') fitScreen($('#menu'));
  }
  $('#btn-start').addEventListener('click', function () { sfx('click'); var g = loadGame(); if (g) fortsaet(g); else nyRejse(); });
  $('#btn-ny').addEventListener('click', function () {
    sfx('click');
    var g = loadGame();
    if (!g) { nyRejse(); return; }
    bekraeft({
      titel: 'Start en ny rejse?', tekst: 'Den gemte rejse (dag ' + g.dag + ', ' + guld(g.guld) + ') forsvinder og kommer ikke på listen.',
      nej: 'Nej, behold den', ja: 'Ja, ny rejse', ikon: 'nytskib', paaJa: nyRejse
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
    $('#btn-bekraeft-ja use').setAttribute('href', '#kap-ikon-' + (o.ikon || 'land'));
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

  // ---------- Rejsen ----------
  // view: 'havn', 'kort' eller 'moede'. fane: 'marked', 'vaerft' eller 'vaerthus'.
  var view = 'havn', fane = 'marked', valgtVare = 'rom', valgtHavn = null, sejler = false;
  var besked = { tekst: '', cls: '' }, moedeLog = '', paused = false, slutVist = false;
  var OVERLAYS = ['#pause-overlay', '#slut-overlay'];
  function overlayOpen() { return bekraeftOpen() || OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); paused = false; releaseGuard(); }
  function setBesked(t, cls) { besked = { tekst: t, cls: cls || '' }; }

  function nyRejse() {
    game = L.createGame();
    slutVist = false; valgtVare = 'rom'; valgtHavn = null; sejler = false;
    view = 'havn'; fane = 'marked';
    setBesked('Velkommen om bord! Du ligger i ' + havnNavn(game.state.havn) + ' med en lille slup. Køb billigt, sælg dyrt – og pas på sørøverne.');
    saveGame(); hideOverlays();
    show('game'); refresh(); sfx('havn');
  }
  function fortsaet(gemt) {
    game = L.createGame(gemt);
    slutVist = false; valgtHavn = null; sejler = false; fane = 'marked';
    var st = game.state;
    if (st.rejse && st.moede && !st.moede.slut) { view = 'moede'; moedeLog = intro(st.moede); }
    else if (st.rejse) { ankomst(null); }
    else { view = 'havn'; setBesked('Velkommen tilbage. Du ligger i ' + havnNavn(st.havn) + '.'); }
    hideOverlays(); show('game'); refresh();
  }
  function spilAktivt() { return current === 'game' && game && !game.state.over && !overlayOpen() && !sejler; }

  function setView(v) {
    view = v;
    $$('#spil .view').forEach(function (el) { el.hidden = el.id !== 'v-' + v; });
    layoutGame();
    refresh();
    guardUnderGaze($('#v-' + v));
  }

  // ---------- Havnen ----------
  function setFane(f) { fane = f; layoutGame(); refresh(); }
  $$('.fane-btn[data-fane]').forEach(function (b) { b.addEventListener('click', function () { if (!spilAktivt()) return; sfx('click'); setFane(b.dataset.fane); }); });
  onAct($('#btn-til-soes'), function () { if (!spilAktivt()) return; sfx('click'); aabnKort(); });

  // Varerne bygges én gang
  (function byggVarer() {
    var box = $('#varer');
    L.VARER.forEach(function (v, i) {
      var b = document.createElement('button');
      b.className = 'btn option vare-btn'; b.dataset.vare = v.id;
      b.innerHTML = '<svg aria-hidden="true"><use href="#kap-ikon-' + v.id + '"/></svg><span class="vare-navn">' + v.navn + '</span>' +
        '<span class="vare-pris"></span><span class="vare-tag"></span><span class="vare-har"></span>';
      b.setAttribute('aria-keyshortcuts', String(i + 1));
      b.addEventListener('click', function () { if (!spilAktivt()) return; sfx('click'); valgtVare = v.id; refresh(); });
      box.appendChild(b);
    });
  })();
  function koeb(n) {
    if (!spilAktivt() || view !== 'havn') return;
    var r = game.koeb(valgtVare, n);
    if (r.ok) {
      var t = 'Du købte ' + r.antal + ' ' + vareNavn(valgtVare) + ' for ' + guld(r.betalt) + '.';
      if (r.grund === 'fuldt') t += ' Nu er lastrummet fuldt.'; else if (r.grund === 'guld') t += ' Mere guld har du ikke.';
      setBesked(t, 'ok'); sfx('moenter');
    } else {
      setBesked(r.grund === 'fuldt' ? 'Lastrummet er fuldt. Sælg noget, eller byg et større lastrum på værftet.' : 'Du har ikke guld nok: 1 ' + vareNavn(valgtVare) + ' koster ' + guld(game.pris(valgtVare).koeb) + '.', 'err');
      sfx('nej');
    }
    saveGame(); refresh();
  }
  function saelg(n) {
    if (!spilAktivt() || view !== 'havn') return;
    var gns = game.gnsKoebt(valgtVare);
    var r = game.saelg(valgtVare, n);
    if (r.ok) {
      var t = 'Du solgte ' + r.antal + ' ' + vareNavn(valgtVare) + ' for ' + guld(r.faaet) + '.';
      if (gns) { var g = r.faaet - gns * r.antal; t += g >= 0 ? ' Fortjeneste: ' + guld(g) + '.' : ' Tab: ' + guld(-g) + '.'; }
      setBesked(t, 'ok'); sfx('saelg');
    } else { setBesked('Du har ingen ' + vareNavn(valgtVare) + ' om bord.', 'err'); sfx('nej'); }
    saveGame(); refresh();
  }
  $$('[data-koeb]').forEach(function (b) { onAct(b, function () { koeb(b.dataset.koeb === 'alt' ? 'alt' : +b.dataset.koeb); }); });
  $$('[data-saelg]').forEach(function (b) { onAct(b, function () { saelg(b.dataset.saelg === 'alt' ? 'alt' : +b.dataset.saelg); }); });

  // Værftet
  function vaerft(hvad) {
    if (!spilAktivt() || view !== 'havn') return;
    var r, t;
    if (hvad === 'reparer') {
      r = game.reparer('alt');
      t = r.ok ? 'Værftet lapper ' + r.antal + ' skrog for ' + guld(r.pris) + '.' : r.grund === 'helt' ? 'Skroget er helt.' : 'Du har ikke guld nok til reparation.';
    } else if (hvad === 'kanon') {
      r = game.koebKanon();
      t = r.ok ? 'En ny kanon er sat om bord for ' + guld(r.pris) + '.' : r.grund === 'max' ? 'Der er ikke plads til flere kanoner på en ' + skibNavn(game.state.skib) + '.' : 'Du mangler ' + guld(r.mangler) + ' til en kanon.';
    } else if (hvad === 'sejl' || hvad === 'lastrum') {
      r = game.opgrader(hvad);
      t = r.ok ? (hvad === 'sejl' ? 'Nye sejl! Farten er nu ' + game.fart() + '.' : 'Lastrummet er bygget om. Der er nu plads til ' + game.lastrum() + '.') + ' Pris: ' + guld(r.pris) + '.'
        : r.grund === 'max' ? 'Det er allerede det bedste, værftet kan lave.' : 'Du mangler ' + guld(r.mangler) + '.';
    } else if (hvad === 'skib') {
      r = game.koebSkib();
      t = r.ok ? 'Tillykke med din nye ' + r.skib.navn.toLowerCase() + '! Den gamle blev taget i bytte. Pris: ' + guld(r.pris) + '.' : r.grund === 'max' ? 'Du har allerede det største skib.' : 'Du mangler ' + guld(r.mangler) + ' til et større skib.';
    }
    setBesked(t, r && r.ok ? 'ok' : 'err'); sfx(r && r.ok ? 'ok' : 'nej');
    saveGame(); refresh();
  }
  $$('[data-vaerft]').forEach(function (b) { onAct(b, function () { vaerft(b.dataset.vaerft); }); });

  // Værtshuset
  function hyr(n) {
    if (!spilAktivt() || view !== 'havn') return;
    var r = game.hyr(n);
    setBesked(r.ok ? stk(r.antal, 'sømand', 'sømænd') + ' går om bord for ' + guld(r.pris) + '.' : r.grund === 'fuldt' ? 'Der er ikke køjer til flere på en ' + skibNavn(game.state.skib) + '.' : 'Du har ikke guld til hyren.', r.ok ? 'ok' : 'err');
    sfx(r.ok ? 'ok' : 'nej'); saveGame(); refresh();
  }
  function proviant(n) {
    if (!spilAktivt() || view !== 'havn') return;
    var r = game.proviant(n);
    setBesked(r.ok ? 'Du køber proviant til ' + stk(r.antal, 'dag', 'dage') + ' for ' + guld(r.pris) + '.' : r.grund === 'fuldt' ? 'Proviantrummet er fuldt.' : 'Du har ikke guld til proviant.', r.ok ? 'ok' : 'err');
    sfx(r.ok ? 'ok' : 'nej'); saveGame(); refresh();
  }
  $$('[data-hyr]').forEach(function (b) { onAct(b, function () { hyr(b.dataset.hyr === 'alt' ? 'alt' : +b.dataset.hyr); }); });
  $$('[data-proviant]').forEach(function (b) { onAct(b, function () { proviant(b.dataset.proviant === 'alt' ? 'alt' : +b.dataset.proviant); }); });

  // Hvor mange kan man købe (prisen stiger 1 % pr. stk.)
  function kanKoebe(vare) {
    var st = game.state, f = st.priser[st.havn][vare], v = L.vareById(vare), g = st.guld, n = 0, fri = game.fri();
    while (n < fri) { var p = Math.max(1, Math.round(v.pris * f)); if (p > g) break; g -= p; n++; f = Math.round(f * 1.01 * 1000) / 1000; }
    return { antal: n, pris: st.guld - g };
  }
  function prisFor(vare, n, salg) {
    var st = game.state, f = st.priser[st.havn][vare], v = L.vareById(vare), s = 0;
    for (var i = 0; i < n; i++) {
      var k = Math.max(1, Math.round(v.pris * f));
      s += salg ? Math.max(1, Math.round(k * 0.88)) : k;
      f = salg ? Math.round(Math.max(0.3, f * 0.99) * 1000) / 1000 : Math.round(f * 1.01 * 1000) / 1000;
    }
    return s;
  }

  function syncHavn() {
    var st = game.state;
    $('#havn-navn').textContent = havnNavn(st.havn);
    var bk = $('#besked'); bk.textContent = besked.tekst; bk.className = 'besked' + (besked.cls ? ' ' + besked.cls : '');
    $$('.fane-btn[data-fane]').forEach(function (b) { var on = b.dataset.fane === fane; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on)); });
    $$('.fane[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== fane; });
    if (fane === 'marked') {
      $$('#varer .vare-btn').forEach(function (b) {
        var id = b.dataset.vare, p = game.pris(id), har = st.last[id], gns = game.gnsKoebt(id);
        b.setAttribute('aria-pressed', String(id === valgtVare));
        $('.vare-pris', b).innerHTML = '<b>' + tal(p.koeb) + '</b> / ' + tal(p.salg);
        var tag = $('.vare-tag', b);
        tag.className = 'vare-tag ' + p.niveau;
        tag.textContent = p.niveau === 'billig' ? '▼ billig' : p.niveau === 'dyr' ? '▲ dyr' : 'normal';
        $('.vare-har', b).textContent = har ? har + ' stk.' : '';
        b.title = har && gns ? 'Du har ' + har + ', købt for ' + gns + ' i gennemsnit' : '';
        b.setAttribute('aria-label', L.vareById(id).navn + ': køb ' + p.koeb + ', sælg ' + p.salg + ', ' + p.niveau + (har ? ', du har ' + har + (gns ? ' købt for ' + gns + ' i gennemsnit' : '') : ''));
      });
      var p = game.pris(valgtVare), har = st.last[valgtVare], kk = kanKoebe(valgtVare);
      $$('[data-koeb]').forEach(function (b) {
        var n = b.dataset.koeb, sm = $('.small', b);
        if (n === 'alt') { sm.textContent = kk.antal ? kk.antal + ' stk. · ' + tal(kk.pris) : 'ingen'; b.disabled = kk.antal === 0; }
        else { var nn = Math.min(+n, Math.max(1, kk.antal)); sm.textContent = (+n > kk.antal && kk.antal > 0 ? nn + ' stk. · ' : '') + guld(prisFor(valgtVare, nn, false)); b.disabled = kk.antal === 0; }
      });
      $$('[data-saelg]').forEach(function (b) {
        var n = b.dataset.saelg, sm = $('.small', b), nn = n === 'alt' ? har : Math.min(+n, har);
        sm.textContent = har ? (n === 'alt' || +n > har ? nn + ' stk. · ' : '') + guld(prisFor(valgtVare, nn, true)) : 'ingen om bord';
        b.disabled = !har;
      });
      $('.handel').setAttribute('aria-label', 'Køb og sælg ' + vareNavn(valgtVare) + ' (' + p.niveau + ')');
    } else if (fane === 'vaerft') {
      var ty = game.type(), mangler = game.maxSkrog() - st.skrog;
      setKob('[data-vaerft="reparer"]', 'Reparér', mangler <= 0 ? 'Skroget er helt' : mangler + ' skrog · ' + guld(mangler * L.REPARATION), mangler <= 0, st.guld < mangler * L.REPARATION && mangler > 0);
      var kp = game.kanonPris();
      setKob('[data-vaerft="kanon"]', 'Ny kanon', kp === null ? 'Fuldt: ' + st.kanoner + ' af ' + ty.kanoner : guld(kp) + ' · har ' + st.kanoner + ' af ' + ty.kanoner, kp === null, kp !== null && st.guld < kp);
      var sp = game.opgraderPris('sejl');
      setKob('[data-vaerft="sejl"]', 'Bedre sejl', sp === null ? 'Bedste sejl · fart ' + game.fart() : guld(sp) + ' · fart ' + game.fart() + ' → ' + (game.fart() + 1), sp === null, sp !== null && st.guld < sp);
      var lp = game.opgraderPris('lastrum');
      setKob('[data-vaerft="lastrum"]', 'Større lastrum', lp === null ? 'Største lastrum · ' + game.lastrum() : guld(lp) + ' · ' + game.lastrum() + ' → ' + Math.round(ty.last * (1 + 0.25 * (st.lastrum + 1))), lp === null, lp !== null && st.guld < lp);
      var ns = game.naesteSkib();
      setKob('[data-vaerft="skib"]', ns ? 'Køb ' + ns.skib.navn.toLowerCase() : 'Største skib', ns ? guld(ns.pris) + ' · bytter din ' + ty.navn.toLowerCase() : 'Du har en galeon', !ns, ns && st.guld < ns.pris);
      $('#skib-kort').innerHTML = '<span><b>' + ty.navn + '</b> · fart ' + game.fart() + ' · lastrum ' + game.lastrum() + '</span>' +
        '<span>Kanoner ' + st.kanoner + ' af ' + ty.kanoner + ' · mandskab ' + st.mandskab + ' af ' + ty.mandskab + '</span>' +
        '<span class="muted">Hver kanon skal bruge 2 mand. Skibets værdi: ' + guld(game.skibsvaerdi()) + '.</span>';
    } else {
      var hp = game.hyrePris(), plads = game.maxMandskab() - st.mandskab, pp = game.proviantPris(), pl = L.PROVIANT_MAX - st.proviant;
      setKob('[data-hyr="1"]', 'Hyr 1', plads <= 0 ? 'Fuldt hold' : guld(hp) + ' · har ' + st.mandskab + ' af ' + game.maxMandskab(), plads <= 0, st.guld < hp);
      setKob('[data-hyr="5"]', 'Hyr 5', plads <= 0 ? 'Fuldt hold' : guld(hp * Math.min(5, plads)) + (plads < 5 ? ' · ' + plads + ' mand' : ''), plads <= 0, st.guld < hp);
      setKob('[data-hyr="alt"]', 'Hyr fuldt hold', plads <= 0 ? 'Fuldt hold' : plads + ' mand · ' + guld(hp * plads), plads <= 0, st.guld < hp);
      setKob('[data-proviant="5"]', 'Proviant 5 dage', pl <= 0 ? 'Fuldt lager' : guld(pp * Math.min(5, pl)) + ' · har ' + st.proviant, pl <= 0, st.guld < pp);
      setKob('[data-proviant="alt"]', 'Fyld proviant', pl <= 0 ? 'Fuldt: ' + L.PROVIANT_MAX + ' dage' : pl + ' dage · ' + guld(pp * pl), pl <= 0, st.guld < pp);
      var r = game.rygte(), rt = '';
      if (r && r.gevinst > 0) rt = '<span><b>Rygte på kroen:</b> ' + L.vareById(r.vare).navn + ' sælges for ' + tal(r.salg) + ' i ' + havnNavn(r.havn) + '. Her koster det ' + tal(r.koeb) + '.</span>';
      else rt = '<span><b>Rygte på kroen:</b> Ingen gode handler herfra lige nu.</span>';
      if (st.beroemmelse >= 10) rt += '<span class="muted">Du er efterlyst – marinen jager dig. Hyren er billigst i Ravnsø, hvor ingen spørger.</span>';
      else rt += '<span class="muted">Mandskabet spiser for ' + guld(pp) + ' om dagen. Hyre her: ' + guld(hp) + ' pr. mand.</span>';
      $('#rygte').innerHTML = rt;
    }
  }
  function setKob(sel, navn, pris, max, dyr) {
    var b = $(sel); $('.kob-navn', b).textContent = navn; $('.kob-pris', b).textContent = pris;
    b.disabled = !!max; b.classList.toggle('max', !!max); b.classList.toggle('dyr', !!dyr && !max);
  }

  // ---------- Kortet ----------
  var kortGeo = null;
  (function byggHavne() {
    var lag = $('#havne-lag');
    L.HAVNE.forEach(function (h) {
      var b = document.createElement('button');
      b.className = 'btn option havn-btn'; b.dataset.havn = h.id;
      b.innerHTML = '<span class="big">' + h.navn + '</span><span class="small"></span>';
      b.addEventListener('click', function () { if (!spilAktivt() || view !== 'kort') return; vaelgHavn(h.id); });
      lag.appendChild(b);
    });
  })();
  function aabnKort() { valgtHavn = null; setBesked(''); setView('kort'); }
  function vaelgHavn(id) {
    if (id === game.state.havn) { sfx('nej'); valgtHavn = null; refresh(); return; }
    sfx('click'); valgtHavn = id; refresh();
  }
  onAct($('#btn-sejl'), function () { if (spilAktivt() && view === 'kort' && valgtHavn) saetSejl(); });
  onAct($('#btn-kort-tilbage'), function () { if (!spilAktivt()) return; sfx('click'); valgtHavn = null; setView('havn'); });

  function layoutKort() {
    var box = $('#kort-boks'), W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    var b = parseFloat(getComputedStyle($('#game')).getPropertyValue('--btn')) || 100;
    var m = 8, gap = 8;
    var hw = Math.min(b * 2.2, (W - 2 * m - 2 * gap) / 3), hh = Math.min(b, (H - 2 * m - 2 * gap) / 3);
    var geo = { w: W, h: H, hw: hw, hh: hh, havne: [] };
    function pos(px, row) { return { x: m + hw / 2 + px * (W - 2 * m - hw), y: m + hh / 2 + row * (H - 2 * m - hh) }; }
    L.HAVNE.forEach(function (h, i) {
      var row = Math.round((h.y - 0.17) / 0.33) / 2, p = pos((h.x - 1 / 6) / (4 / 6), row);
      geo.havne.push({ id: h.id, cx: p.x, cy: p.y, bw: hw, bh: hh, oe: i % 4 });
      var el = $('.havn-btn[data-havn="' + h.id + '"]');
      el.style.left = Math.round(p.x - hw / 2) + 'px'; el.style.top = Math.round(p.y - hh / 2) + 'px';
      el.style.width = Math.round(hw) + 'px'; el.style.height = Math.round(hh) + 'px';
    });
    $('#havne-lag').style.setProperty('--hh', Math.round(hh) + 'px');
    $('#havne-lag').style.setProperty('--hw', Math.round(hw) + 'px');
    var ps = Math.min(hw, hh) * 0.9;
    geo.pynt = [[0, 0.5, 1], [0.5, 0.5, 3], [0.25, 0, 2], [0.75, 1, 0], [0.25, 1, 1], [0.75, 0, 3]].map(function (a) { var p = pos(a[0], a[1]); return { x: p.x, y: p.y, s: ps, oe: a[2] }; });
    var kp = pos(1, 0.5);
    geo.kompas = { x: kp.x + hw / 2 - Math.min(hh, hw) * 0.45, y: kp.y, r: Math.min(hh, hw) * 0.42 };
    kortGeo = geo;
  }
  function tegnKort() {
    if (!kortGeo) return;
    T.kort($('#kort-svg'), { w: kortGeo.w, h: kortGeo.h, havne: kortGeo.havne, her: game.state.rejse ? null : game.state.havn, valgt: valgtHavn, pynt: kortGeo.pynt, kompas: kortGeo.kompas });
  }
  function syncKort() {
    var st = game.state;
    $$('.havn-btn').forEach(function (b) {
      var id = b.dataset.havn, her = id === st.havn;
      b.setAttribute('aria-pressed', String(id === valgtHavn));
      if (her) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current');
      $('.small', b).textContent = her ? '⚓ du er her' : stk(game.rejseDage(id), 'dag', 'dage');
      b.setAttribute('aria-label', L.havnById(id).navn + (her ? ', du er her' : ', ' + game.rejseDage(id) + ' dage'));
    });
    var titel = $('#kort-titel'), info = $('#kort-info');
    if (!valgtHavn) {
      titel.textContent = 'Vælg en havn';
      info.innerHTML = 'Du ligger i ' + havnNavn(st.havn) + '. Proviant til ' + stk(st.proviant, 'dag', 'dage') + '.';
    } else {
      var h = L.havnById(valgtHavn), ri = game.rejseInfo(valgtHavn);
      titel.textContent = h.navn + ' · ' + stk(ri.dage, 'dag', 'dage');
      var t = (ri.nok ? '<span class="ok">Proviant nok (' + st.proviant + ').</span> ' : '<span class="err">For lidt proviant: ' + st.proviant + ' af ' + ri.dage + ' dage. Mandskabet sulter!</span> ') +
        'Billigt: ' + liste(h.billig.map(vareNavn)) + '. Dyrt: ' + liste(h.dyr.map(vareNavn)) + '.';
      if (h.flaade) t += ' Marinens flådehavn.';
      if (h.skjul) t += ' Sørøvernes skjul.';
      info.innerHTML = t;
    }
    $('#btn-sejl').disabled = !valgtHavn || sejler;
    $('#btn-kort-tilbage').disabled = sejler;
    tegnKort();
  }
  // Skibet sejler hen over kortet (eller springer straks frem uden animation)
  function sejlAnim(fra, til, frac, done) {
    var ship = $('#kortskib'), a = null, b = null;
    if (kortGeo) kortGeo.havne.forEach(function (p) { if (p.id === fra) a = p; if (p.id === til) b = p; });
    if (!a || !b || !animationOn()) { ship.hidden = true; done(); return; }
    var ang = Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180 / Math.PI, dur = 900 + 900 * frac, t0 = null;
    ship.hidden = false;
    $('svg', ship).style.transform = 'rotate(' + ang + 'deg)';
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, f = e * frac;
      ship.style.transform = 'translate(' + (a.cx + (b.cx - a.cx) * f) + 'px,' + (a.cy + (b.cy - a.cy) * f) + 'px)';
      if (k < 1 && current === 'game') requestAnimationFrame(step); else setTimeout(function () { ship.hidden = true; done(); }, 250);
    }
    requestAnimationFrame(step);
  }
  function saetSejl() {
    var fra = game.state.havn, til = valgtHavn, r = game.sejl(til);
    if (!r) return;
    sejler = true; sfx('boelger'); saveGame(); refresh();
    var frac = r.moede ? Math.max(0.2, Math.min(0.8, r.moede.dagNr / r.dage)) : 1;
    sejlAnim(fra, til, frac, function () {
      sejler = false; valgtHavn = null;
      if (game.state.over) { slutSpil(); return; }
      if (r.moede) {
        moedeLog = (r.sult ? sultTekst(r.sult) + ' ' : '') + intro(r.moede);
        sfx(r.moede.slags === 'storm' ? 'storm' : 'sejlISigte');
        setView('moede');
      } else ankomst(r.sult);
      saveGame();
    });
  }
  function sultTekst(s) { return 'Proviantet slap op i ' + stk(s.dage, 'dag', 'dage') + ', og ' + stk(s.tab, 'sømand', 'sømænd') + ' døde af sult.'; }
  function ankomst(sult) {
    var st = game.state, dage = st.rejse ? st.rejse.dage : 0;
    if (!game.ankom()) return;
    setBesked('Du lægger til i ' + havnNavn(st.havn) + (dage ? ' efter ' + stk(dage, 'dag', 'dage') : '') + '.' + (sult ? ' ' + sultTekst(sult) : ''), sult ? 'err' : '');
    fane = 'marked'; sfx('havn');
    if (current === 'game') setView('havn'); else view = 'havn';
    saveGame();
  }

  // ---------- Møder til søs ----------
  function fjendeNavn(m) {
    return m.slags === 'handel' ? 'Handelsskibet ' + m.navn : m.slags === 'pirat' ? 'Sørøveren ' + m.navn : 'Orlogsskibet ' + m.navn;
  }
  function intro(m) {
    if (m.slags === 'storm') return 'En storm trækker op! Vil du ride den af (skroget tager skade) eller søge læ ved en ø (2 dage mere)?';
    if (m.slags === 'handel') return fjendeNavn(m) + ' er i sigte. Det er fredeligt – sejl videre, eller angrib det og tag lasten.';
    if (m.slags === 'pirat') return 'Sørøvere! ' + m.navn + ' har set dig og sætter kurs mod dig.';
    return game.erFjendtlig(m) ? 'Marinen! ' + fjendeNavn(m) + ' har hørt om dig og vil tage dig til fange.' : fjendeNavn(m) + ' patruljerer. Det lader dig være, hvis du lader det være.';
  }
  function skudTekst(s, dig) {
    if (!s || !s.kanoner) return '';
    var hvem = dig ? 'Du skyder med ' + stk(s.kanoner, 'kanon', 'kanoner') : 'De skyder med ' + stk(s.kanoner, 'kanon', 'kanoner');
    if (!s.traef) return hvem + ', men alt ryger i vandet.';
    return hvem + ': ' + stk(s.traef, 'træffer', 'træffer') + ', ' + s.skade + ' i skade' + (dig ? '.' : ' på dit skrog.');
  }
  function rundeTekst(h, m) {
    var t = [], sp = h.spiller, fj = h.fjende;
    if (sp.type === 'skud') t.push(skudTekst(sp.skud, true));
    else if (sp.type === 'naermere') t.push(sp.ok ? 'Du kommer nærmere.' : 'De holder afstanden.');
    else if (sp.type === 'bord') t.push(sp.vandt ? 'I entrer skibet og vinder kampen om bord. Du mister ' + stk(sp.tab, 'mand', 'mand') + '.' : 'I entrer skibet, men bliver slået tilbage. Du mister ' + stk(sp.tab, 'mand', 'mand') + '.');
    else if (sp.type === 'flygt') t.push(sp.ok ? 'Du sætter alle sejl og slipper væk.' : 'Du prøver at flygte, men de hænger på.');
    else if (sp.type === 'videre') t.push('I sejler hver til sit.');
    if (fj) {
      if (fj.type === 'flygter') t.push(fj.ok ? 'De sætter alle sejl og prøver at slippe væk.' : 'De prøver at flygte, men du hænger på.');
      if (fj.naermere) t.push('De kommer nærmere.');
      if (fj.type === 'bord') t.push(fj.vandt ? 'De entrer dit skib og vinder kampen! Du mister ' + stk(fj.tab, 'mand', 'mand') + '.' : 'De entrer dit skib, men I slår dem tilbage og tager deres skib! Du mister ' + stk(fj.tab, 'mand', 'mand') + '.');
      if (fj.skud) t.push(skudTekst(fj.skud, false));
    }
    if (m.slut) t.push(slutTekst(m, h));
    return t.filter(Boolean).join(' ');
  }
  function slutTekst(m, h) {
    var b = m.bytte;
    switch (m.slut) {
      case 'kapret': return 'Skibet er dit! Du tager ' + guld(b.guld) + (lastTekst(b.last) ? ' og ' + lastTekst(b.last) : '') + '. +' + b.beroemmelse + ' berømmelse.' + (b.efterladt ? ' Der var ikke plads til ' + b.efterladt + ' varer.' : '');
      case 'sænket': return 'Skibet synker. Du fisker ' + guld(b.guld) + ' op. +' + b.beroemmelse + ' berømmelse.';
      case 'flygtet': return '';
      case 'videre': return '';
      case 'undsluppet': return 'Skibet slap væk.';
      case 'plyndret': return 'Sørøverne plyndrer dig og tager ' + guld(h.plyndret.guld) + (lastTekst(h.plyndret.last) ? ' og ' + lastTekst(h.plyndret.last) : '') + '.';
      case 'afvist': return 'Handelsfolkene forsvarer deres skib. I må opgive.';
      default: return '';
    }
  }
  function moedeLyde(h) {
    var sp = h.spiller, fj = h.fjende, d = 0;
    if (sp.type === 'skud') { sfx('kanon'); sfx(sp.skud.traef ? 'traef' : 'plask', 0.35); d = 0.8; }
    else if (sp.type === 'bord') { sfx('bordning'); d = 0.8; }
    else if (sp.type === 'flygt' || sp.type === 'naermere' || sp.type === 'videre') { sfx('boelger'); d = 0.5; }
    if (fj && fj.skud && fj.skud.kanoner) { sfx('kanon', d); sfx(fj.skud.traef ? 'traef' : 'plask', d + 0.35); }
    if (fj && fj.type === 'bord') sfx('bordning', d);
  }
  function handling(valg) {
    if (!spilAktivt() || view !== 'moede') return;
    var m = game.state.moede;
    if (!m || m.slut || m.slags === 'storm') return;
    var h = game.handling(valg);
    if (!h) return;
    if (h.fejl) {
      moedeLog = h.fejl === 'ingen-kanoner' ? 'Du har ingen kanoner, der kan skyde (hver kanon skal bruge 2 mand).' : h.fejl === 'helt-taet' ? 'I ligger allerede langs siden.' : 'Du skal helt tæt på for at borde.';
      sfx('nej'); refresh(); return;
    }
    moedeLog = rundeTekst(h, m);
    moedeLyde(h);
    if (m.slut === 'kapret' || m.slut === 'sænket') sfx('moenter', 1.0);
    saveGame();
    refresh();
    if (game.state.over) slutSpil();
    else if (m.slut) { $('#btn-videre').focus({ preventScroll: true }); guardUnderGaze($('#moede-knapper')); }
  }
  onAct($('#btn-skyd'), function () { handling('skyd'); });
  onAct($('#btn-naermere'), function () { handling('naermere'); });
  onAct($('#btn-bord'), function () { handling('bord'); });
  onAct($('#btn-flygt'), function () { handling('flygt'); });
  function stormValg(valg) {
    if (!spilAktivt() || view !== 'moede') return;
    var r = game.storm(valg);
    if (!r) return;
    moedeLog = (valg === 'laa' ? 'Du søger læ bag en ø og venter stormen af i 2 dage. Skroget tager ' + r.skade + ' i skade.' : 'Du rider stormen af. Bølgerne slår ' + r.skade + ' af skroget.') + (r.sult ? ' ' + sultTekst(r.sult) : '');
    sfx(valg === 'laa' ? 'boelger' : 'storm');
    saveGame(); refresh();
    if (game.state.over) slutSpil(); else guardUnderGaze($('#moede-knapper'));
  }
  onAct($('#btn-ride'), function () { stormValg('ride'); });
  onAct($('#btn-laa'), function () { stormValg('laa'); });
  onAct($('#btn-videre'), function () {
    if (!spilAktivt() || view !== 'moede') return;
    var m = game.state.moede; if (!m || !m.slut) return;
    sfx('click'); ankomst(null);
  });
  function bar(v, max) { var p = Math.max(0, Math.min(100, Math.round(100 * v / max))); return '<span class="bar' + (p < 35 ? ' lav' : '') + '"><i style="width:' + p + '%"></i></span>'; }
  function syncMoede() {
    var st = game.state, m = st.moede, knapper = $('#moede-knapper');
    if (!m) return;
    var fase = m.slags === 'storm' ? (m.slut ? 'slut' : 'storm') : (m.slut ? 'slut' : 'kamp');
    knapper.dataset.fase = fase;
    var info = $('#fjende-info');
    if (m.slags === 'storm') info.innerHTML = '<span class="scene-chip navn">Storm</span><span class="scene-chip vigtig">Dit skrog ' + st.skrog + bar(st.skrog, game.maxSkrog()) + '</span>';
    else {
      var fjendtlig = game.erFjendtlig(m);
      info.innerHTML = '<span class="scene-chip navn">' + fjendeNavn(m) + '</span>' +
        '<span class="scene-chip vigtig">' + AFSTAND[Math.min(4, m.afstand)] + '</span>' +
        '<span class="scene-chip vigtig">Skrog ' + m.skrog + bar(m.skrog, m.maxSkrog) + '</span>' +
        '<span class="scene-chip">Kanoner ' + m.kanoner + '</span><span class="scene-chip">Mandskab ' + m.mandskab + '</span>' +
        '<span class="scene-chip">' + (fjendtlig ? 'Fjendtlig' : 'Fredelig') + '</span>';
    }
    $('#moede-log').textContent = moedeLog;
    if (fase === 'kamp') {
      var eff = game.effKanoner(), fred = !game.erFjendtlig(m);
      var tc = game.traefChance(m.afstand);
      setMoedeBtn('#btn-skyd', 'Skyd', eff ? stk(eff, 'kanon', 'kanoner') + ' · ' + Math.round(tc * 100) + ' % træf' : 'Ingen kanoner klar', !eff);
      setMoedeBtn('#btn-naermere', 'Ryk nærmere', m.afstand <= 0 ? 'I er langs siden' : Math.round(game.naermereChance(m) * 100) + ' % chance', m.afstand <= 0);
      setMoedeBtn('#btn-bord', 'Bord', m.afstand > 0 ? 'Først helt tæt på' : Math.round(game.bordChance(m) * 100) + ' % chance', m.afstand > 0);
      setMoedeBtn('#btn-flygt', fred ? 'Sejl videre' : 'Flygt', fred ? 'Lad dem være' : Math.round(game.flugtChance(m) * 100) + ' % chance', false);
      $('#btn-flygt use').setAttribute('href', '#kap-ikon-' + (fred ? 'videre' : 'flygt'));
    } else if (fase === 'slut') {
      var til = st.rejse ? havnNavn(st.rejse.til) : '';
      $('#btn-videre .big').textContent = st.over ? 'Rejsen er slut' : 'Sejl videre';
      $('#btn-videre .small').textContent = st.over ? '' : 'til ' + til;
      $('#btn-videre').disabled = !!st.over;
    }
    tegnScene();
  }
  function setMoedeBtn(sel, navn, small, dis) { var b = $(sel); $('.big', b).textContent = navn; $('.small', b).textContent = small; b.disabled = !!dis; }
  function tegnScene() {
    var box = $('.scene-boks'), m = game && game.state.moede;
    if (!m || !box.clientWidth) return;
    var sidste = m.haendelser && m.haendelser.length ? m.haendelser[m.haendelser.length - 1] : null;
    T.moede($('#scene-svg'), {
      w: box.clientWidth, h: box.clientHeight, spiller: { type: game.state.skib }, storm: m.slags === 'storm',
      fjende: m.slags === 'storm' ? null : { type: m.skibstype, slags: m.slags, afstand: m.afstand },
      sidste: sidste, slut: m.slut
    });
  }

  // ---------- Statuslinjen ----------
  function syncHud() {
    var st = game.state;
    function set(k, v, lav) { var el = $('.hud[data-hud="' + k + '"]'); $('.hud-value', el).textContent = v; el.classList.toggle('lav', !!lav); }
    set('dag', tal(st.dag));
    set('guld', tal(st.guld));
    set('skrog', st.skrog + '/' + game.maxSkrog(), st.skrog < game.maxSkrog() * 0.35);
    set('mandskab', st.mandskab + '/' + game.maxMandskab(), st.mandskab < 4);
    set('kanoner', game.effKanoner() < st.kanoner ? game.effKanoner() + ' (' + st.kanoner + ')' : String(st.kanoner));
    set('proviant', String(st.proviant), st.proviant < 4);
    set('last', game.lastIalt() + '/' + game.lastrum());
    set('beroemmelse', String(st.beroemmelse), st.beroemmelse >= 10);
    $('.hud[data-hud="beroemmelse"]').title = st.beroemmelse >= 10 ? 'Marinen jager dig' : '';
    fitHud();
  }
  // Lange tal (fx 100/100) må ikke klippes: krymp skriften i statuslinjen, til alt kan ses.
  function fitHud() {
    var hud = $('#hud'); if (!hud || !hud.clientWidth) return;
    var k = 1; hud.style.setProperty('--hud-k', '1');
    function over() { return $$('.hud', hud).some(function (el) { return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1; }); }
    while (k > 0.5 && over()) { k -= 0.06; hud.style.setProperty('--hud-k', k.toFixed(2)); }
  }

  function refresh() {
    if (!game || current !== 'game') return;
    syncHud();
    $$('#spil .view').forEach(function (el) { el.hidden = el.id !== 'v-' + view; });
    if (view === 'havn') syncHavn();
    else if (view === 'kort') syncKort();
    else syncMoede();
    $('#btn-pause').disabled = sejler;
  }

  // ---------- Slut ----------
  function slutSpil() {
    var over = game.state.over;
    if (!over || slutVist) return;
    slutVist = true;
    var rank = records.add('point', over.point, { dage: over.dage, skib: over.skib, grund: over.grund }).rank;
    saveGame();
    $('#slut-kicker').textContent = over.grund === 'land' ? 'Du gik i land' : 'Rejsen er slut';
    $('#slut-title').textContent = tal(over.point) + ' point';
    $('#slut-grund').textContent = GRUND[over.grund] || '';
    $('#slut-tal').textContent = stk(over.dage, 'dag', 'dage') + ' til søs med en ' + skibNavn(over.skib) + '. Formue ' + guld(over.formue) + (over.grund === 'land' ? ' (med skibet)' : '') + ' · berømmelse ' + over.beroemmelse + ' (×10).';
    $('#slut-rank').textContent = rank ? (rank === 1 ? 'Ny rekord! Nummer 1 på listen.' : 'Nummer ' + rank + ' på top 10.') : '';
    setTimeout(function () {
      if (current !== 'game') return;
      var ov = $('#slut-overlay');
      ov.hidden = false; fitScreen(ov); dwell.reset(); guardUnderGaze(ov);
      sfx(over.grund === 'land' ? 'sejr' : 'gameOver');
      $('#btn-slut-ny').focus({ preventScroll: true });
    }, over.grund === 'land' ? 0 : 900);
  }
  $('#btn-slut-ny').addEventListener('click', function () { sfx('click'); nyRejse(); });
  $('#btn-slut-menu').addEventListener('click', function () { sfx('click'); hideOverlays(); show('menu'); });
  $('#btn-slut-rekorder').addEventListener('click', function () { sfx('click'); hideOverlays(); openRecords('menu'); });

  // ---------- Pause ----------
  function setPaused(p) {
    if (!game || game.state.over || sejler) return;
    paused = p;
    var ov = $('#pause-overlay');
    ov.hidden = !p;
    var land = $('#btn-land');
    land.disabled = !!game.state.rejse;
    $('.small', land).textContent = game.state.rejse ? 'kun i en havn' : 'slut og gem point';
    if (p) { fitScreen(ov); dwell.reset(); guardUnderGaze(ov); $('#btn-resume').focus({ preventScroll: true }); sfx('click'); }
    else { releaseGuard(); dwell.reset(); guardUnderGaze($('#game')); }
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(true); });
  $('#btn-resume').addEventListener('click', function () { sfx('click'); setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-pause-menu').addEventListener('click', function () { sfx('click'); saveGame(); hideOverlays(); show('menu'); });
  $('#btn-land').addEventListener('click', function () {
    if (!game || game.state.rejse) return;
    sfx('click');
    var f = game.formue(), b = game.state.beroemmelse;
    bekraeft({
      titel: 'Gå i land?', ikon: 'land', nej: 'Nej, sejl videre', ja: 'Ja, gå i land',
      tekst: 'Du sælger skibet og går i land med en formue på ' + guld(f) + ' og ' + b + ' berømmelse. Det giver ' + tal(f + 10 * b) + ' point, og rejsen slutter.',
      paaJa: function () { hideOverlays(); game.gaaILand(); slutSpil(); }
    });
  });

  // ---------- Rekorder ----------
  var recordsReturn = 'menu';
  function openRecords(from) { recordsReturn = from || 'menu'; syncRecords(); show('records'); }
  var GRUND_KORT = { sunket: 'sank', taget: 'taget af marinen', storm: 'storm', sult: 'sult', mandskab: 'uden mandskab', land: 'gik i land' };
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
        x.textContent = ' · ' + stk(e.dage || 0, 'dag', 'dage') + (e.skib ? ' · ' + skibNavn(e.skib) : '');
        if (e.grund && GRUND_KORT[e.grund]) li.title = GRUND_KORT[e.grund];
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
    if (settingsReturn === 'game' && game && !game.state.over) { show('game'); refresh(); setPaused(true); }
    else show('menu');
  });

  // ---------- Tastatur ----------
  // Havnen: 1–5 vælger vare, K køber 1 (Skift: 5), S sælger 1 (Skift: 5), M/V/T skifter fane, Enter = til søs.
  // Kortet: pilene vælger havn, Enter sætter sejl, Backspace = bliv i havnen.
  // Mødet: S skyder, N rykker nærmere, B entrer, F flygter/sejler videre; R/L i storm; Enter = sejl videre.
  // Esc eller P = pause.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (bekraeftOpen()) { if (e.key === 'Escape') { e.preventDefault(); $('#btn-bekraeft-nej').click(); } return; }
    if (current !== 'game' || !game) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (game.state.over || sejler) return;
      e.preventDefault(); setPaused(!paused); return;
    }
    if (overlayOpen() || sejler || game.state.over) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, handled = true;
    if (e.repeat && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    if (view === 'havn') {
      if (/^[1-5]$/.test(k)) { setFane('marked'); valgtVare = L.VARER[+k - 1].id; sfx('click'); refresh(); }
      else if (k === 'k' && fane === 'marked') koeb(e.shiftKey ? 5 : 1);
      else if (k === 's' && fane === 'marked') saelg(e.shiftKey ? 5 : 1);
      else if (k === 'm') setFane('marked');
      else if (k === 'v') setFane('vaerft');
      else if (k === 't') setFane('vaerthus');
      else if (k === 'Enter' && document.activeElement === document.body) aabnKort();
      else handled = false;
    } else if (view === 'kort') {
      var ids = L.HAVNE.map(function (h) { return h.id; }).filter(function (id) { return id !== game.state.havn; });
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowUp') {
        var i = ids.indexOf(valgtHavn), d = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : -1;
        vaelgHavn(ids[(i < 0 ? (d > 0 ? 0 : ids.length - 1) : (i + d + ids.length) % ids.length)]);
      } else if (k === 'Enter' && document.activeElement === document.body) { if (valgtHavn) saetSejl(); }
      else if (k === 'Backspace') { valgtHavn = null; setView('havn'); }
      else handled = false;
    } else if (view === 'moede') {
      var m = game.state.moede;
      if (m && !m.slut && m.slags !== 'storm') {
        if (k === 's') handling('skyd'); else if (k === 'n') handling('naermere'); else if (k === 'b') handling('bord'); else if (k === 'f' || k === 'v') handling('flygt'); else handled = false;
      } else if (m && !m.slut) {
        if (k === 'r') stormValg('ride'); else if (k === 'l') stormValg('laa'); else handled = false;
      } else if (m && m.slut && (k === 'Enter' || k === 'v') && document.activeElement === document.body) ankomst(null);
      else handled = false;
    } else handled = false;
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
  // Knapper i spillet, hvis tekst ikke kan være der
  function gameOverflow() {
    var vEl = $('#v-' + view);
    return overflows(gameEl) || (vEl && overflows(vEl)) || btnOverflow();
  }
  function btnOverflow() {
    return $$('#spil .btn').some(function (b) { return b.offsetParent && (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2); });
  }
  function applyGame(b, v) {
    var land = v.W >= v.H * 1.1, lav = land && v.H < 600, mn = Math.min(v.W, v.H);
    var pad = Math.max(8, Math.round(mn * 0.014)), ig = Math.max(8, Math.min(16, Math.round(mn * 0.012)));
    var hud8 = land && v.W - 2 * pad - b - ig >= 8 * 88;
    gameEl.classList.toggle('lay-bred', land); gameEl.classList.toggle('lay-hoej', !land);
    gameEl.classList.toggle('lav', lav); gameEl.classList.toggle('hud8', hud8);
    var st = gameEl.style, inner = v.W - 2 * pad;
    st.setProperty('--btn', b + 'px'); st.setProperty('--pad', pad + 'px'); st.setProperty('--ig', ig + 'px');
    st.setProperty('--hud-h', Math.round(hud8 ? Math.max(SMALL_MIN, b * 0.8) : b) + 'px');
    var hav = lav ? inner - 2 * b - 2 * ig : inner;
    st.setProperty('--var-cols', hav >= 5 * b * 1.25 + 4 * ig ? 5 : 3);
    st.setProperty('--handel-cols', hav >= 6 * b + 5 * ig ? 6 : 3);
    var pw = Math.round(Math.max(2 * b + ig, Math.min(inner * 0.3, 2.6 * b + ig)));
    st.setProperty('--kpanel-w', pw + 'px'); st.setProperty('--mpanel-w', pw + 'px');
    st.setProperty('--kort-min', (3 * SMALL_MIN + 32) + 'px');
    st.setProperty('--scene-min', Math.round(Math.min(260, v.H * 0.3)) + 'px');
  }
  function layoutGame() {
    if (current !== 'game') return;
    var v = viewport(), small = isSmall(v), floor = SMALL_MIN;
    var b = Math.max(floor, cssBtn(v.W, v.H));
    var spil = $('#spil');
    spil.style.zoom = ''; gameEl.classList.remove('tight');
    $$('#spil .view').forEach(function (el) { el.hidden = el.id !== 'v-' + view; });
    if (game) { if (view === 'havn') syncHavn(); else if (view === 'kort') syncKort(); else syncMoede(); }
    applyGame(b, v);
    for (var i = 0; i < 16 && gameOverflow() && b > floor; i++) { b = Math.max(floor, b * 0.94); applyGame(b, v); }
    if (gameOverflow()) gameEl.classList.add('tight');
    var z = 1;
    for (var j = 0; j < 8 && gameOverflow(); j++) {
      var vEl = $('#v-' + view), r = Math.min(0.97, gameEl.clientHeight / gameEl.scrollHeight, gameEl.clientWidth / gameEl.scrollWidth);
      if (vEl && vEl.scrollHeight) r = Math.min(r, vEl.clientHeight / vEl.scrollHeight, vEl.clientWidth / vEl.scrollWidth);
      z = Math.max(0.5, z * r); spil.style.zoom = String(z);
    }
    gameEl.dataset.btn = Math.round(b);
    layoutKort();
    if (game) { if (view === 'kort') tegnKort(); if (view === 'moede') tegnScene(); }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
    root.classList.toggle('kap-lille', small);
    fitHud();
  }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('kap-lille', small);
    root.classList.toggle('kap-tvaers', small && v.W > v.H);
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
      var host = (o.navBottom && !root.classList.contains('kap-tvaers')) ? o.navBottom : o.navIn;
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
      if (el.id === 'menu' && !root.classList.contains('kap-tvaers')) {
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
  window.Kaperen = {
    get game() { return game; }, get view() { return view; }, get fane() { return fane; }, get sejler() { return sejler; },
    get paused() { return paused; }, get guard() { return gazeGuard ? gazeGuard.id : null; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    nyRejse: nyRejse, show: show, setView: setView, setFane: setFane, vaelgHavn: vaelgHavn, sejl: saetSejl,
    handling: handling, storm: stormValg, layout: layoutGame, refresh: refresh, setPaused: setPaused,
    vaelgVare: function (id) { valgtVare = id; refresh(); },
    // Til test: læg en gemt tilstand ind og vis den
    setState: function (st, v) { game = L.createGame(st); slutVist = false; view = v || (st.moede && !st.moede.slut ? 'moede' : 'havn'); if (view === 'moede') moedeLog = intro(st.moede); hideOverlays(); show('game'); refresh(); },
    save: saveGame
  };
})();
