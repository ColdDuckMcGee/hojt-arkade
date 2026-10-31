/*
 * Kaperen – app.js: skærme, knapper, layout, dwell, tastatur, indstillinger,
 * rekorder og gem. Spillets regler ligger i js/logik.js (kender ingen farver),
 * tegningerne i js/tegn.js og grafikken i tema/<navn>/.
 *
 * Alt er turbaseret: intet sker, før spilleren vælger.
 */
(function () {
  'use strict';
  /* LUFT: mindst 24 px mellem knapper med forskellig betydning – en øjenstyring rammer inden for ca. 20–40 px */
  var LUFT = 24;

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
    try { var raw = localStorage.getItem(SAVE_KEY); var g = raw ? JSON.parse(raw) : null; return g && !g.over && g.skib && (g.havn || g.pos || g.rejse) ? g : null; } catch (e) { return null; }
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
  // Ét blik = én handling: dwell.js' fælles blik-lås sørger for, at samme knap først kan vælges
  // igen, når blikket har forladt den, og dialogvagten (dwell.guard) for knapper, der dukker op
  // lige under blikket. (Før havde hvert spil sin egen kopi af begge dele.)
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  function onAct(el, fn) { el.addEventListener('click', function (e) { fn(e); }); }

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
  }
  function applyBackground() { bg.setMode(arkade.get('background')); }
  function applyAnimation() {
    bg.setAnimated(animationOn());
    root.classList.toggle('kap-stille', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden, og skibet sejler felt for felt efter kursen';
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
    dwell.guard($('#' + id));
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var gemt = loadGame();
    if (gemt) {
      $('#btn-start-label').textContent = 'Fortsæt rejsen';
      $('#btn-start-sub').textContent = 'Dag ' + gemt.dag + ' · ' + (gemt.havn ? havnNavn(gemt.havn) : 'til søs') + ' · ' + guld(gemt.guld);
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
    ov.hidden = false; fitScreen(ov); dwell.reset(); dwell.guard(ov);
    $('#btn-bekraeft-nej').focus({ preventScroll: true });
  }
  function lukBekraeft() { $('#bekraeft-overlay').hidden = true; dwell.unguard(); dwell.reset(); bekraeftJa = null; }
  function bekraeftOpen() { return !$('#bekraeft-overlay').hidden; }
  $('#btn-bekraeft-nej').addEventListener('click', function () {
    sfx('click'); lukBekraeft();
    if (bekraeftFra && bekraeftFra.focus && document.contains(bekraeftFra)) bekraeftFra.focus({ preventScroll: true });
  });
  onAct($('#btn-bekraeft-ja'), function () { var f = bekraeftJa; lukBekraeft(); sfx('click'); if (f) f(); });

  // ---------- Rejsen ----------
  // view: 'havn', 'hav', 'kort' eller 'moede'. fane: 'marked', 'vaerft' eller 'vaerthus'.
  var view = 'havn', fane = 'marked', valgtVare = 'rom';
  var besked = { tekst: '', cls: '' }, moedeLog = '', paused = false, slutVist = false;
  var OVERLAYS = ['#pause-overlay', '#slut-overlay'];
  function overlayOpen() { return bekraeftOpen() || OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); paused = false; dwell.unguard(); }
  function setBesked(t, cls) { besked = { tekst: t, cls: cls || '' }; }

  function nyRejse() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    game = L.createGame();
    slutVist = false; valgtVare = 'rom'; valgtHavn = null; afgang = null; retning = 0; clearTimeout(kursTimer);
    view = 'havn'; fane = 'marked';
    setBesked('Velkommen om bord! Du ligger i ' + havnNavn(game.state.havn) + ' med en lille slup og ' + guld(game.state.guld) + '. Havet omkring dig ligger i tåge – sejl ud og find de andre havne.');
    saveGame(); hideOverlays();
    show('game'); refresh(); sfx('havn');
  }
  function fortsaet(gemt) {
    game = L.createGame(gemt);
    slutVist = false; valgtHavn = null; afgang = null; fane = 'marked'; clearTimeout(kursTimer);
    var st = game.state, ny = st.migreret ? 'Kaperen er blevet opdateret: havet er nyt og ligger i tåge. ' : '';
    delete st.migreret;
    game.stopKurs();
    if (st.moede && !st.moede.slut) { view = 'moede'; moedeLog = ny + intro(st.moede); }
    else if (st.havn) { view = 'havn'; setBesked(ny + 'Velkommen tilbage. Du ligger i ' + havnNavn(st.havn) + '.'); }
    else { if (st.moede) game.efterMoede(); view = 'hav'; setHavLog(ny + 'Velkommen tilbage. Du er til søs – dag ' + st.dag + '.'); }
    hideOverlays(); show('game'); refresh();
  }
  function spilAktivt() { return current === 'game' && game && !game.state.over && !overlayOpen(); }

  function setView(v) {
    view = v;
    $$('#spil .view').forEach(function (el) { el.hidden = el.id !== 'v-' + v; });
    layoutGame();
    refresh();
    dwell.guard($('#v-' + v));
  }

  // ---------- Havnen ----------
  function setFane(f) { fane = f; layoutGame(); refresh(); }
  $$('.fane-btn[data-fane]').forEach(function (b) { b.addEventListener('click', function () { if (!spilAktivt()) return; sfx('click'); setFane(b.dataset.fane); }); });

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
    } else if (hvad === 'kikkert') {
      r = game.koebKikkert();
      t = r.ok ? 'En ' + (game.kikkertPris() === null ? 'fin messingkikkert' : 'kikkert') + '! Nu kan du se ' + r.syn + ' felter ud over havet. Pris: ' + guld(r.pris) + '.' : r.grund === 'max' ? 'Du har allerede værftets bedste kikkert.' : 'Du mangler ' + guld(r.mangler) + ' til kikkerten.';
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
  onAct($('#btn-rygte'), function () {
    if (!spilAktivt() || view !== 'havn') return;
    var r = game.rygteHavn();
    setBesked(r.ok ? 'For ' + guld(r.pris) + ' fortæller en gammel sømand om ' + havnNavn(r.havn) + '. Havnen er tegnet ind på dit søkort.' : r.grund === 'alle' ? 'Du kender allerede alle havne.' : 'Du mangler ' + guld(r.mangler || 0) + ' til et rygte.', r.ok ? 'ok' : 'err');
    sfx(r.ok ? 'ok' : 'nej'); saveGame(); refresh();
  });

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
      var kk2 = game.kikkertPris(), sv = game.synsvidde();
      setKob('[data-vaerft="kikkert"]', kk2 === null ? 'Bedste kikkert' : 'Kikkert', kk2 === null ? 'Synsvidde ' + sv + ' felter' : guld(kk2) + ' · syn ' + sv + ' → ' + (sv + 1), kk2 === null, kk2 !== null && st.guld < kk2);
      $('#skib-kort').innerHTML = '<span><b>' + ty.navn + '</b> · fart ' + game.fart() + ' · lastrum ' + game.lastrum() + ' · syn ' + sv + '</span>' +
        '<span>Kanoner ' + st.kanoner + ' af ' + ty.kanoner + ' · mandskab ' + st.mandskab + ' af ' + ty.mandskab + '</span>' +
        '<span class="muted">Hver kanon skal bruge 2 mand. Skibets værdi: ' + guld(game.skibsvaerdi()) + '.</span>';
    } else {
      var hp = game.hyrePris(), plads = game.maxMandskab() - st.mandskab, pp = game.proviantPris(), pl = L.PROVIANT_MAX - st.proviant;
      setKob('[data-hyr="1"]', 'Hyr 1', plads <= 0 ? 'Fuldt hold' : guld(hp) + ' · har ' + st.mandskab + ' af ' + game.maxMandskab(), plads <= 0, st.guld < hp);
      setKob('[data-hyr="5"]', 'Hyr 5', plads <= 0 ? 'Fuldt hold' : guld(hp * Math.min(5, plads)) + (plads < 5 ? ' · ' + plads + ' mand' : ''), plads <= 0, st.guld < hp);
      setKob('[data-hyr="alt"]', 'Hyr fuldt hold', plads <= 0 ? 'Fuldt hold' : plads + ' mand · ' + guld(hp * plads), plads <= 0, st.guld < hp);
      setKob('[data-proviant="5"]', 'Proviant 5 dage', pl <= 0 ? 'Fuldt lager' : guld(pp * Math.min(5, pl)) + ' · har ' + st.proviant, pl <= 0, st.guld < pp);
      setKob('[data-proviant="alt"]', 'Fyld proviant', pl <= 0 ? 'Fuldt: ' + L.PROVIANT_MAX + ' dage' : pl + ' dage · ' + guld(pp * pl), pl <= 0, st.guld < pp);
      var rp = game.rygtePris();
      setKob('#btn-rygte', 'Rygte om en havn', rp === null ? 'Du kender alle havne' : guld(rp) + ' · en ny havn på kortet', rp === null, rp !== null && st.guld < rp);
      var r = game.rygte(), rt = '';
      if (r && r.gevinst > 0) rt = '<span><b>Rygte på kroen:</b> ' + L.vareById(r.vare).navn + ' sælges for ' + tal(r.salg) + ' i ' + havnNavn(r.havn) + '. Her koster det ' + tal(r.koeb) + '.</span>';
      else rt = '<span><b>Rygte på kroen:</b> Ingen gode handler til de havne, du kender.</span>';
      if (st.beroemmelse >= 10) rt += '<span class="muted">Du er efterlyst – marinen jager dig. Hyren er billigst i Ravnsø, hvor ingen spørger.</span>';
      else rt += '<span class="muted">Mandskabet spiser for ' + guld(pp) + ' om dagen. Hyre her: ' + guld(hp) + ' pr. mand.</span>';
      $('#rygte').innerHTML = rt;
    }
  }
  function setKob(sel, navn, pris, max, dyr) {
    var b = $(sel); $('.kob-navn', b).textContent = navn; $('.kob-pris', b).textContent = pris;
    b.disabled = !!max; b.classList.toggle('max', !!max); b.classList.toggle('dyr', !!dyr && !max);
  }

  // ---------- Havet: ét felt er én dag ----------
  // Skibet står midt i billedet. Rundt om det er havet, man kan se (synsvidden),
  // det, man har set før (dunkelt), og tåge over det ukendte.
  var RET_NAVN = ['nord', 'nordøst', 'øst', 'sydøst', 'syd', 'sydvest', 'vest', 'nordvest'];
  var SLAGS_NAVN = { handel: 'Et handelsskib', pirat: 'En sørøver', marine: 'Et orlogsskib fra marinen' };
  var retning = 0, havLog = { tekst: '', cls: '' }, afgang = null, kursTimer = 0, kortFra = 'hav', havGeo = null;
  function setHavLog(t, cls) { havLog = { tekst: t, cls: cls || '' }; }
  function kursAktiv() { return !!(game && game.state.kurs); }
  function retningTil(dx, dy) {
    if (!dx && !dy) return '';
    var a = Math.round(Math.atan2(dx, -dy) / (Math.PI / 4));
    return RET_NAVN[(a + 8) % 8];
  }
  function tilSoes() {
    var st = game.state;
    setHavLog(st.havn ? 'Du ligger i ' + havnNavn(st.havn) + '. Vælg en retning – hvert felt tager en dag – eller åbn kortet.' : '');
    setView('hav');
  }
  onAct($('#btn-til-soes'), function () { if (!spilAktivt()) return; sfx('click'); tilSoes(); });
  $$('[data-ret]').forEach(function (b) { onAct(b, function () { sejlRet(+b.dataset.ret); }); });
  function sejlRet(i) {
    if (!spilAktivt() || view !== 'hav' || kursAktiv()) return;
    var d = L.RETNINGER[i], st = game.state, fra = st.havn, dag0 = st.dag;
    var r = game.flyt(d[0], d[1]);
    if (!r.ok) {
      setHavLog(r.grund === 'land' ? 'Der er land mod ' + RET_NAVN[i] + '.' : r.grund === 'kant' ? 'Her ender søkortet. Længere mod ' + RET_NAVN[i] + ' kan du ikke sejle.' : 'Du kan ikke sejle lige nu.', 'err');
      sfx('nej'); refresh(); return;
    }
    retning = Math.atan2(d[1], d[0]) * 180 / Math.PI;
    if (fra && !st.havn) { afgang = { havn: fra, dag: dag0 }; sfx('boelger'); }
    efterTrin(r);
  }
  function venDag() {
    if (!spilAktivt() || view !== 'hav' || game.state.havn) return;
    var r = game.vent();
    if (!r.ok) { sfx('nej'); return; }
    efterTrin(r, 'Du ligger stille en dag.');
  }
  onAct($('#btn-hav-ekstra'), function () {
    if (!spilAktivt() || view !== 'hav') return;
    if (kursAktiv()) { stopKurs('Du stopper og tager selv roret.'); return; }
    if (game.state.havn) { sfx('click'); setBesked(''); fane = 'marked'; setView('havn'); return; }
    venDag();
  });
  function sultTekst(s) { return 'Der er ingen proviant: ' + stk(s.tab, 'sømand', 'sømænd') + ' døde af sult.'; }
  function skibTekst(ids) {
    var st = game.state, t = [];
    ids.forEach(function (id) {
      var s = st.skibe.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var farlig = s.slags === 'pirat' || (s.slags === 'marine' && st.beroemmelse >= 10);
      t.push(SLAGS_NAVN[s.slags] + ' er i sigte mod ' + retningTil(s.x - st.pos[0], s.y - st.pos[1]) + '.' + (farlig ? ' Pas på!' : ''));
    });
    return t.join(' ');
  }
  // Efter hver dag på havet: tekst, lyd, møde eller ankomst. Svarer 'over', 'moede', 'havn' eller null.
  function efterTrin(r, foer) {
    var st = game.state, t = [], cls = '';
    if (foer) t.push(foer);
    if (r.sult) { t.push(sultTekst(r.sult)); cls = 'err'; }
    if (st.over) { setHavLog(t.join(' '), 'err'); saveGame(); refresh(); slutSpil(); return 'over'; }
    if (r.nyeHavne && r.nyeHavne.length) { t.push('Land i sigte! Du har opdaget ' + liste(r.nyeHavne.map(havnNavn)) + '.'); cls = cls || 'ok'; sfx('ok'); }
    if (r.moede) {
      moedeLog = (t.length ? t.join(' ') + ' ' : '') + intro(r.moede);
      sfx(r.moede.slags === 'storm' ? 'storm' : 'sejlISigte');
      saveGame(); setView('moede'); return 'moede';
    }
    if (r.havn) {
      var dage = afgang ? st.dag - afgang.dag : 0;
      setBesked('Du lægger til i ' + havnNavn(r.havn) + (dage > 0 ? ' efter ' + stk(dage, 'dag', 'dage') : '') + '.' + (r.sult ? ' ' + sultTekst(r.sult) : ''), r.sult ? 'err' : '');
      afgang = null; fane = 'marked'; sfx('havn');
      saveGame(); setView('havn'); return 'havn';
    }
    if (r.nyeSkibe && r.nyeSkibe.length) { t.push(skibTekst(r.nyeSkibe)); sfx('sejlISigte'); }
    if (!st.proviant) { if (!r.sult) t.push('Proviantet er sluppet op! Find en havn – ellers sulter mandskabet.'); cls = 'err'; }
    else if (st.proviant <= 3) { t.push('Kun proviant til ' + stk(st.proviant, 'dag', 'dage') + ' mere.'); cls = cls || 'err'; }
    setHavLog(t.length ? t.join(' ') : 'Dag ' + st.dag + '. Havet er roligt.', cls);
    saveGame(); refresh();
    return null;
  }

  // Kurs mod en kendt havn: skibet sejler selv over kendt hav, ét felt ad gangen,
  // og stopper, hvis et skib kommer i sigte, en storm trækker op, eller proviantet slipper op.
  var STOP_TEKST = {
    skib: 'Du stopper og tager selv roret.',
    proviant: 'Proviantet er sluppet op – du stopper.',
    'ingen-vej': 'Der er ingen kendt vej videre. Sejl selv gennem tågen.',
    blokeret: 'Vejen er spærret. Sejl selv udenom.',
    havn: ''
  };
  function stopKurs(t) {
    clearTimeout(kursTimer); kursTimer = 0;
    if (game) game.stopKurs();
    if (t) setHavLog(t);
    sfx('click'); saveGame(); refresh();
  }
  function kursTrin() {
    if (!game || !kursAktiv() || current !== 'game' || paused || overlayOpen() || view !== 'hav') return false;
    var st = game.state, x0 = st.pos[0], y0 = st.pos[1], fra = st.havn, dag0 = st.dag;
    var r = game.autoTrin();
    if (!r) return false;
    if (!r.ok) { setHavLog(STOP_TEKST[r.stop] || 'Kursen er stoppet.', 'err'); sfx('nej'); refresh(); return false; }
    if (st.pos[0] !== x0 || st.pos[1] !== y0) retning = Math.atan2(st.pos[1] - y0, st.pos[0] - x0) * 180 / Math.PI;
    if (fra && !st.havn) afgang = { havn: fra, dag: dag0 };
    var res = efterTrin(r);
    if (res) return false;
    if (r.stop) {
      var ekstra = STOP_TEKST[r.stop];
      if (ekstra) { setHavLog((havLog.tekst ? havLog.tekst + ' ' : '') + ekstra, r.stop === 'skib' ? havLog.cls : 'err'); refresh(); }
      return false;
    }
    return kursAktiv();
  }
  function koerKurs() {
    clearTimeout(kursTimer); kursTimer = 0;
    if (!animationOn()) {   // uden bevægelse: hele vejen på én gang (stopper stadig ved skibe m.m.)
      for (var n = 0; n < 400 && kursTrin(); n++) { /* næste dag */ }
      return;
    }
    if (kursTrin()) kursTimer = setTimeout(koerKurs, 380);
  }

  function syncHav() {
    var st = game.state, kurs = kursAktiv();
    var ek = $('#btn-hav-ekstra');
    if (kurs) { $('.big', ek).textContent = 'Stop'; $('.small', ek).textContent = 'tag selv roret'; $('use', ek).setAttribute('href', '#kap-ikon-stop'); }
    else if (st.havn) { $('.big', ek).textContent = 'Gå i havn'; $('.small', ek).textContent = havnNavn(st.havn); $('use', ek).setAttribute('href', '#kap-ikon-anker'); }
    else { $('.big', ek).textContent = 'Vent en dag'; $('.small', ek).textContent = 'lig stille'; $('use', ek).setAttribute('href', '#kap-ikon-vent'); }
    $$('.ret-btn[data-ret], .felt-btn').forEach(function (b) {
      var d = L.RETNINGER[+b.dataset.ret], ft = game.felt(st.pos[0] + d[0], st.pos[1] + d[1]);
      b.disabled = kurs || ft === 'land' || ft === 'ude';
    });
    $('#btn-hav-kort').disabled = kurs;
    var info = '<span class="scene-chip navn">' + (st.havn ? 'I havn: ' + havnNavn(st.havn) : 'Til søs') + '</span>';
    if (kurs) { var ki = game.kursInfo(st.kurs.til); info += '<span class="scene-chip vigtig">Kurs: ' + havnNavn(st.kurs.til) + (ki ? ' · ' + stk(ki.dage, 'dag', 'dage') : '') + '</span>'; }
    info += '<span class="scene-chip">Synsvidde ' + game.synsvidde() + '</span><span class="scene-chip">Opdaget ' + Math.round(game.andelOpdaget() * 100) + ' %</span>';
    $('#hav-info').innerHTML = info;
    var lg = $('#hav-log'); lg.textContent = havLog.tekst; lg.className = 'scene-log' + (havLog.cls ? ' ' + havLog.cls : '');
    tegnHav();
  }
  function havneData() {
    var st = game.state;
    return L.HAVNE.map(function (h) { var p = game.havnePos(h.id); return { id: h.id, x: p[0], y: p[1], navn: h.navn, kendt: !!st.kendt[h.id] }; });
  }
  function skibeData() {
    var st = game.state;
    return game.synligeSkibe().map(function (s) {
      var dx = st.pos[0] - s.x, dy = st.pos[1] - s.y;
      if (s.slags === 'handel') { dx = -dx; dy = -dy; }
      return { x: s.x, y: s.y, slags: s.slags, retning: Math.atan2(dy, dx) * 180 / Math.PI };
    });
  }
  function tegnHav() {
    var box = $('#hav-boks'), W = box.clientWidth, H = box.clientHeight, st = game.state;
    if (!W || !H) return;
    var syn = game.synsvidde(), ts = Math.min(W, H) / (2 * (syn + 1) + 1);
    ts = Math.min(ts, Math.max(W, H) / 7);
    havGeo = { W: W, H: H, ts: ts };
    T.felter($('#hav-svg'), {
      w: W, h: H, ts: ts, cx: st.pos[0], cy: st.pos[1], felt: game.felt, sett: game.sett, iSyn: game.iSyn,
      havne: havneData(), valgt: st.kurs ? st.kurs.til : null, skibe: skibeData(),
      spiller: { x: st.pos[0], y: st.pos[1], retning: retning }, kurs: st.kurs ? game.sti(st.kurs.til) : null, syn: syn, kort: false
    });
    $$('#felt-lag .felt-btn').forEach(function (b) {
      var d = L.RETNINGER[+b.dataset.ret];
      b.style.left = Math.round(W / 2 + (d[0] - 0.5) * ts) + 'px'; b.style.top = Math.round(H / 2 + (d[1] - 0.5) * ts) + 'px';
      b.style.width = Math.round(ts) + 'px'; b.style.height = Math.round(ts) + 'px';
    });
  }

  // ---------- Søkortet: det, du har opdaget ----------
  var valgtHavn = null;
  function kortHavne() { return game.kortHavne(); }
  function aabnKort() {
    kortFra = view === 'havn' ? 'havn' : 'hav';
    valgtHavn = game.state.kurs && game.state.kendt[game.state.kurs.til] ? game.state.kurs.til : game.forvalgtHavn();
    setView('kort');
  }
  onAct($('#btn-hav-kort'), function () { if (!spilAktivt() || view !== 'hav' || kursAktiv()) return; sfx('click'); aabnKort(); });
  function vaelgHavn(id) {
    if (!game || !game.state.kendt[id] || id === game.state.havn) { sfx('nej'); return; }
    sfx('click'); valgtHavn = id; refresh();
  }
  function skiftHavn(d) {
    var ids = kortHavne(); if (!ids.length) return;
    var i = ids.indexOf(valgtHavn);
    vaelgHavn(ids[i < 0 ? 0 : (i + d + ids.length) % ids.length]);
  }
  onAct($('#btn-havn-forrige'), function () { if (spilAktivt() && view === 'kort') skiftHavn(-1); });
  onAct($('#btn-havn-naeste'), function () { if (spilAktivt() && view === 'kort') skiftHavn(1); });
  onAct($('#btn-kurs'), function () { if (spilAktivt() && view === 'kort' && valgtHavn) saetKurs(); });
  onAct($('#btn-kort-tilbage'), function () { if (!spilAktivt()) return; sfx('click'); setView(kortFra === 'havn' && game.state.havn ? 'havn' : 'hav'); });
  // Klik på en havn på kortet vælger den
  $('#kort-svg').addEventListener('click', function (e) {
    if (!spilAktivt() || view !== 'kort' || !kortGeo) return;
    var r = this.getBoundingClientRect(), g = kortGeo;
    var x = Math.round(g.cx + (e.clientX - r.left - g.w / 2) / g.ts), y = Math.round(g.cy + (e.clientY - r.top - g.h / 2) / g.ts);
    var best = null, bd = 2.5;
    L.HAVNE.forEach(function (h) { var p = game.havnePos(h.id), d = Math.max(Math.abs(p[0] - x), Math.abs(p[1] - y)); if (game.state.kendt[h.id] && d < bd) { bd = d; best = h.id; } });
    if (best) vaelgHavn(best);
  });
  function saetKurs() {
    var st = game.state, fra = st.havn, dag0 = st.dag, til = valgtHavn;
    var r = game.saetKurs(til);
    if (!r.ok) {
      $('#kort-info').innerHTML = '<span class="err">' + (r.grund === 'ingen-vej' ? 'Der er ingen kendt vej derhen endnu. Sejl selv gennem tågen.' : r.grund === 'ukendt' ? 'Den havn kender du ikke endnu.' : 'Du kan ikke sætte kurs lige nu.') + '</span>';
      sfx('nej'); return;
    }
    if (fra) { afgang = { havn: fra, dag: dag0 }; }
    var ki = game.kursInfo(til);
    setHavLog('Kurs mod ' + havnNavn(til) + ': ' + stk(r.dage, 'dag', 'dage') + '. Skibet sejler selv og stopper, hvis et skib kommer i sigte.' + (ki && !ki.nok ? ' Proviantet rækker kun til ' + stk(st.proviant, 'dag', 'dage') + '!' : ''), ki && !ki.nok ? 'err' : '');
    sfx('boelger');
    setView('hav');
    koerKurs();
  }
  var kortGeo = null;
  function tegnKort() {
    var box = $('#kort-boks'), W = box.clientWidth, H = box.clientHeight, st = game.state;
    if (!W || !H) return;
    // Zoom ind på den del af havet, man har opdaget (+ 1 felts kant), dog højst 8 felter på den korte led.
    var x0 = st.pos[0], x1 = x0, y0 = st.pos[1], y1 = y0, x, y;
    for (y = 0; y < L.HOEJDE; y++) for (x = 0; x < L.BREDDE; x++) if (game.sett(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    x0 = Math.max(-0.5, x0 - 1.5); x1 = Math.min(L.BREDDE - 0.5, x1 + 1.5); y0 = Math.max(-0.5, y0 - 1.5); y1 = Math.min(L.HOEJDE - 0.5, y1 + 1.5);
    var ts = Math.min(W / (x1 - x0), H / (y1 - y0), Math.min(W, H) / 8);
    kortGeo = { w: W, h: H, ts: ts, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    T.felter($('#kort-svg'), {
      w: W, h: H, ts: ts, cx: kortGeo.cx, cy: kortGeo.cy, felt: game.felt, sett: game.sett, iSyn: null,
      havne: havneData(), valgt: valgtHavn, skibe: skibeData(),
      spiller: { x: st.pos[0], y: st.pos[1], retning: retning }, kurs: valgtHavn ? game.sti(valgtHavn) : null, syn: null, kort: true
    });
  }
  function syncKort() {
    var st = game.state, ids = kortHavne();
    if (valgtHavn && ids.indexOf(valgtHavn) < 0) valgtHavn = game.forvalgtHavn();
    var titel = $('#kort-titel'), info = $('#kort-info'), ki = valgtHavn ? game.kursInfo(valgtHavn) : null;
    $('#kort-chips').innerHTML = '<span class="scene-chip navn">Søkortet</span><span class="scene-chip">Opdaget ' + Math.round(game.andelOpdaget() * 100) + ' %</span>' +
      '<span class="scene-chip">Havne ' + game.kendteHavne().length + ' af ' + L.HAVNE.length + '</span>';
    if (!valgtHavn) {
      var bag = !st.havn && st.sidste && ids.indexOf(st.sidste) >= 0;
      titel.textContent = 'Ingen ny havn';
      info.innerHTML = bag
        ? 'Du kender kun ' + havnNavn(st.sidste) + ', som du lige har forladt. Sejl videre ud i tågen for at finde en ny havn, eller vælg ' + havnNavn(st.sidste) + ' med »Forrige havn« eller »Næste havn«, hvis du vil tilbage.'
        : 'Du kender ingen andre havne endnu. Sejl ud i tågen, eller køb et rygte i værtshuset.';
    } else {
      var h = L.havnById(valgtHavn);
      titel.textContent = h.navn + (ki ? ' · ' + stk(ki.dage, 'dag', 'dage') : '');
      var t = ki ? (ki.nok ? '<span class="ok">Proviant nok (' + st.proviant + ').</span> ' : '<span class="err">For lidt proviant: ' + st.proviant + ' af ' + ki.dage + ' dage!</span> ')
        : '<span class="err">Ingen kendt vej derhen endnu.</span> ';
      t += 'Billigt: ' + liste(h.billig.map(vareNavn)) + '. Dyrt: ' + liste(h.dyr.map(vareNavn)) + '.';
      if (h.flaade) t += ' Marinens flådehavn.';
      if (h.skjul) t += ' Sørøvernes skjul.';
      info.innerHTML = t;
    }
    var kanSkifte = ids.length > 1 || (ids.length === 1 && valgtHavn !== ids[0]);
    $('#btn-havn-forrige').disabled = !kanSkifte;
    $('#btn-havn-naeste').disabled = !kanSkifte;
    $('#btn-kurs').disabled = !ki || !ki.dage;
    $('#btn-kurs .small').textContent = ki ? stk(ki.dage, 'dag', 'dage') : valgtHavn ? 'ingen kendt vej' : '';
    $('#btn-kort-tilbage .big').textContent = kortFra === 'havn' && st.havn ? 'Bliv i havnen' : 'Tilbage';
    tegnKort();
  }

  // ---------- Møder til søs ----------
  function fjendeNavn(m) {
    return m.slags === 'handel' ? 'Handelsskibet ' + m.navn : m.slags === 'pirat' ? 'Sørøveren ' + m.navn : 'Orlogsskibet ' + m.navn;
  }
  function intro(m) {
    if (m.slags === 'storm') return 'En storm trækker op! Vil du ride den af (skroget tager skade) eller søge læ ved en ø (2 dage mere)?';
    if (m.slags === 'handel') return fjendeNavn(m) + ' er i sigte. Det er fredeligt – sejl videre, eller angrib det og tag lasten.';
    if (m.slags === 'pirat') return m.overfald
      ? 'Overfald! Sørøveren ' + m.navn + ' har jaget dig og ligger lige ved siden af. De vil entre dig og tage dit guld og din last – kæmp, eller flygt.'
      : 'Sørøvere! ' + m.navn + ' har set dig og sætter kurs mod dig.';
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
      if (fj.type === 'entrehager') t.push('De kaster entrehager og trækker sig langs siden af dig – næste gang entrer de!');
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
    if (fj && (fj.type === 'bord' || fj.type === 'entrehager')) sfx('bordning', d);
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
    else if (m.slut) { $('#btn-videre').focus({ preventScroll: true }); dwell.guard($('#moede-knapper')); }
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
    if (game.state.over) slutSpil(); else dwell.guard($('#moede-knapper'));
  }
  onAct($('#btn-ride'), function () { stormValg('ride'); });
  onAct($('#btn-laa'), function () { stormValg('laa'); });
  onAct($('#btn-videre'), function () {
    if (!spilAktivt() || view !== 'moede') return;
    var m = game.state.moede; if (!m || !m.slut) return;
    sfx('click'); videre();
  });
  function videre() {
    game.efterMoede();
    setHavLog(game.state.havn ? '' : 'Du er tilbage på havet. Dag ' + game.state.dag + '.');
    saveGame(); setView('hav');
  }
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
      $('#btn-videre .big').textContent = st.over ? 'Rejsen er slut' : 'Sejl videre';
      $('#btn-videre .small').textContent = st.over ? '' : 'tilbage til havet';
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
    else if (view === 'hav') syncHav();
    else if (view === 'kort') syncKort();
    else syncMoede();
  }

  // ---------- Slut ----------
  function slutSpil() {
    var over = game.state.over;
    if (!over || slutVist) return;
    slutVist = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    var rank = records.add('point', over.point, { dage: over.dage, skib: over.skib, grund: over.grund }).rank;
    saveGame();
    $('#slut-kicker').textContent = over.grund === 'land' ? 'Du gik i land' : 'Rejsen er slut';
    $('#slut-title').textContent = tal(over.point) + ' point';
    $('#slut-grund').textContent = GRUND[over.grund] || '';
    $('#slut-tal').textContent = stk(over.dage, 'dag', 'dage') + ' til søs med en ' + skibNavn(over.skib) + '. Formue ' + guld(over.formue) + (over.grund === 'land' ? ' (med skibet)' : '') + ' · berømmelse ' + over.beroemmelse + ' (×' + L.BEROEMMELSE_FAKTOR + ').';
    $('#slut-rank').textContent = rank ? (rank === 1 ? 'Ny rekord! Nummer 1 på listen.' : 'Nummer ' + rank + ' på top 10.') : '';
    setTimeout(function () {
      if (current !== 'game') return;
      var ov = $('#slut-overlay');
      ov.hidden = false; fitScreen(ov); dwell.reset(); dwell.guard(ov);
      sfx(over.grund === 'land' ? 'sejr' : 'gameOver');
      $('#btn-slut-ny').focus({ preventScroll: true });
    }, over.grund === 'land' ? 0 : 900);
  }
  $('#btn-slut-ny').addEventListener('click', function () { sfx('click'); nyRejse(); });
  $('#btn-slut-menu').addEventListener('click', function () { sfx('click'); hideOverlays(); show('menu'); });
  $('#btn-slut-rekorder').addEventListener('click', function () { sfx('click'); hideOverlays(); openRecords('menu'); });

  // ---------- Pause ----------
  function setPaused(p) {
    if (!game || game.state.over) return;
    paused = p;
    var ov = $('#pause-overlay');
    ov.hidden = !p;
    var land = $('#btn-land'), iHavn = kanGaaILand();
    land.disabled = !iHavn;
    $('.small', land).textContent = iHavn ? 'slut og gem point' : 'kun i en havn';
    if (p) { clearTimeout(kursTimer); fitScreen(ov); dwell.reset(); dwell.guard(ov); $('#btn-resume').focus({ preventScroll: true }); sfx('click'); }
    else { dwell.unguard(); dwell.reset(); dwell.guard($('#game')); if (kursAktiv() && view === 'hav') kursTimer = setTimeout(koerKurs, 300); }
  }
  function kanGaaILand() { var st = game.state; return !!st.havn && !(st.moede && !st.moede.slut); }
  $('#btn-pause').addEventListener('click', function () { setPaused(true); });
  $('#btn-resume').addEventListener('click', function () { sfx('click'); setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-pause-menu').addEventListener('click', function () { sfx('click'); saveGame(); hideOverlays(); show('menu'); });
  $('#btn-land').addEventListener('click', function () {
    if (!game || !kanGaaILand()) return;
    sfx('click');
    var f = game.formue(), b = game.state.beroemmelse;
    bekraeft({
      titel: 'Gå i land?', ikon: 'land', nej: 'Nej, sejl videre', ja: 'Ja, gå i land',
      tekst: 'Du sælger skibet og går i land med en formue på ' + guld(f) + ' og ' + b + ' berømmelse. Det giver ' + tal(f + L.BEROEMMELSE_FAKTOR * b) + ' point (formue + ' + L.BEROEMMELSE_FAKTOR + ' point pr. berømmelse), og rejsen slutter.',
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
  // Havet: piletasterne sejler mod nord/syd/øst/vest, Home/PgUp/End/PgDn (eller numpad 7/9/1/3) på skrå,
  //        mellemrum eller 5 = vent en dag, K = søkortet, Enter = gå i havn, Backspace = stop kursen.
  // Kortet: piletasterne vælger havn, Enter sætter kurs, Backspace = tilbage.
  // Mødet: S skyder, N rykker nærmere, B entrer, F flygter/sejler videre; R/L i storm; Enter = sejl videre.
  // Esc eller P = pause.
  var TAST_RET = { ArrowUp: 0, PageUp: 1, ArrowRight: 2, PageDown: 3, ArrowDown: 4, End: 5, ArrowLeft: 6, Home: 7,
    '8': 0, '9': 1, '6': 2, '3': 3, '2': 4, '1': 5, '4': 6, '7': 7 };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (bekraeftOpen()) { if (e.key === 'Escape') { e.preventDefault(); $('#btn-bekraeft-nej').click(); } return; }
    if (current !== 'game' || !game) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (game.state.over) return;
      e.preventDefault(); setPaused(!paused); return;
    }
    if (overlayOpen() || game.state.over) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, handled = true;
    var pil = k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';
    if (e.repeat && !pil && !(view === 'hav' && k in TAST_RET)) return;
    if (view === 'havn') {
      if (/^[1-5]$/.test(k)) { setFane('marked'); valgtVare = L.VARER[+k - 1].id; sfx('click'); refresh(); }
      else if (k === 'k' && fane === 'marked') koeb(e.shiftKey ? 5 : 1);
      else if (k === 's' && fane === 'marked') saelg(e.shiftKey ? 5 : 1);
      else if (k === 'm') setFane('marked');
      else if (k === 'v') setFane('vaerft');
      else if (k === 't') setFane('vaerthus');
      else if (k === 'Enter' && document.activeElement === document.body) tilSoes();
      else handled = false;
    } else if (view === 'hav') {
      if (k in TAST_RET) { if (!kursAktiv()) sejlRet(TAST_RET[k]); }
      else if (k === ' ' || k === '5' || k === 'Clear') { if (!kursAktiv()) venDag(); }
      else if (k === 'k') { if (!kursAktiv()) { sfx('click'); aabnKort(); } }
      else if (k === 'Backspace') { if (kursAktiv()) stopKurs('Du stopper og tager selv roret.'); }
      else if (k === 'Enter' && document.activeElement === document.body) { if (kursAktiv()) stopKurs('Du stopper og tager selv roret.'); else if (game.state.havn) $('#btn-hav-ekstra').click(); }
      else handled = false;
    } else if (view === 'kort') {
      if (pil) skiftHavn(k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1);
      else if (k === 'Enter' && document.activeElement === document.body) { if (!$('#btn-kurs').disabled) saetKurs(); }
      else if (k === 'Backspace' || k === 'k') $('#btn-kort-tilbage').click();
      else handled = false;
    } else if (view === 'moede') {
      var m = game.state.moede;
      if (m && !m.slut && m.slags !== 'storm') {
        if (k === 's') handling('skyd'); else if (k === 'n') handling('naermere'); else if (k === 'b') handling('bord'); else if (k === 'f' || k === 'v') handling('flygt'); else handled = false;
      } else if (m && !m.slut) {
        if (k === 'r') stormValg('ride'); else if (k === 'l') stormValg('laa'); else handled = false;
      } else if (m && m.slut && (k === 'Enter' || k === 'v') && document.activeElement === document.body) videre();
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
    var pad = Math.max(8, Math.round(mn * 0.014)), ig = mn < 560 ? Math.max(8, Math.min(16, Math.round(mn * 0.012))) : Math.max(LUFT, Math.min(32, Math.round(mn * 0.02)));   // mobil (under 560 px): som før
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
    if (game) { if (view === 'havn') syncHavn(); else if (view === 'hav') syncHav(); else if (view === 'kort') syncKort(); else syncMoede(); }
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
    if (game) { if (view === 'hav') tegnHav(); if (view === 'kort') tegnKort(); if (view === 'moede') tegnScene(); }
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
    get game() { return game; }, get view() { return view; }, get fane() { return fane; }, get sejler() { return kursAktiv(); },
    get valgtHavn() { return valgtHavn; }, get havLog() { return havLog.tekst; },
    get paused() { return paused; }, get guard() { return dwell.guarded ? dwell.guarded.id : null; },
    settings: arkade, gameSettings: gset, records: records, dwell: dwell, audio: audio, lyd: lyd, logik: L,
    nyRejse: nyRejse, show: show, setView: setView, setFane: setFane, vaelgHavn: vaelgHavn, saetKurs: saetKurs,
    sejlRet: sejlRet, vent: venDag, aabnKort: aabnKort, tilSoes: tilSoes, stopKurs: stopKurs,
    handling: handling, storm: stormValg, layout: layoutGame, refresh: refresh, setPaused: setPaused,
    vaelgVare: function (id) { valgtVare = id; refresh(); },
    // Til test: læg en gemt tilstand ind og vis den
    setState: function (st, v) {
      clearTimeout(kursTimer); game = L.createGame(st); slutVist = false;
      view = v || (st.moede && !st.moede.slut ? 'moede' : st.havn ? 'havn' : 'hav');
      if (view === 'moede') moedeLog = intro(st.moede);
      hideOverlays(); show('game'); refresh();
    },
    save: saveGame
  };
})();
