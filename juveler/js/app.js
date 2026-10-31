/*
 * Juveler – brugerflade: skærme, input, indstillinger, lyd og rekorder.
 * Bygger på de fælles moduler i ../arkade/ ligesom Blokke, Bobler og Pixelgåder.
 *
 * Vælg en juvel (klik, tryk, dwell eller Enter), og vælg så en nabo for at bytte.
 * Naboer, der giver tre på stribe, lyser op. Et ugyldigt byt forklares og koster
 * intet. Vælg den valgte juvel igen (eller Fortryd valg) for at fortryde.
 * Der er ingen tid. Spillet slutter, når trækkene er brugt, når brættet ikke har flere
 * mulige byt (eller man vælger Afslut).
 *
 * Spillet er endeløst med niveauer: når pointmålet nås, kommer næste niveau (+5 træk),
 * og nye elementer forklares på et roligt kort (#niveau-overlay), der lukkes med en stor
 * knap. Status viser Træk, Point (med målet), Niveau og Opgave.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var G = window.JuvelerGame;

  // ---------- Indstillinger (fælles for Hojt Arkade + spillets egne) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork',
    animation: true, sound: true, music: true
  });
  // mode: brættets størrelse ('6x6', '7x7' eller '8x8').
  // visMaal: naboer, der giver et gyldigt byt, lyser op, når en juvel er valgt.
  // gloed: temaets glød og lysskær (kan slås fra; spillet kan aflæses uden).
  // introKort: et introkort forklarer hvert nyt element ved niveauskift (fra: kun en note i status).
  var bset = ArkadeSettings.create('juveler', { mode: '7x7', visMaal: true, gloed: true, introKort: true });
  var records = ArkadeHighscores.create('juveler', { max: 10 });

  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');
  if (G.SIZE_ORDER.indexOf(bset.get('mode')) < 0) bset.set('mode', '7x7');

  var reducedMotionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Moduler ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  // Ét blik = én handling: dwell.js' fælles blik-lås sørger for, at samme knap først kan vælges
  // igen, når blikket har forladt den, og dialogvagten (dwell.guard) for knapper, der dukker op
  // lige under blikket. (Før havde hvert spil sin egen kopi af begge dele.)
  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });

  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  // Lydene kommer fra det fælles lydmodul (alle rolige). Juveler bruger disse navne:
  var SFX = {
    select: 'click', swap: 'move', match: 'eat', chain: 'bonus', earn: 'bonusSpawn', invalid: 'obstacle',
    tip: 'bonusSpawn', over: 'crash', record: 'record', click: 'click', pause: 'pause'
  };
  function sfx(name) { audio.play(SFX[name] || name); }
  function unlockAudio() { audio.unlock(); }
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
    $('#game').classList.toggle('calm', !animationOn());
    $('#motion-note').textContent = reducedMotionMq.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Bevægelse i baggrunden, og juvelerne glider og falder roligt. Fra giver faste skift';
  }
  if (reducedMotionMq.addEventListener) reducedMotionMq.addEventListener('change', applyAnimation);

  arkade.onChange(function (key, value) {
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    if (key === 'dwell') { dwell.setEnabled(value); renderBoard(); } // felternes klikbarhed følger dwell (tegn.js)
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') audio.setSfx(value);
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    syncSettingsUi();
  });
  function applyGlow() { root.setAttribute('data-jv-gloed', bset.get('gloed') ? 'til' : 'fra'); }
  bset.onChange(function (key) {
    if (key === 'gloed') applyGlow();
    if (key === 'visMaal' || key === 'gloed') { syncSettingsUi(); if (run && sel >= 0) targets = run.targets(sel); renderBoard(); }
  });

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
  function sizeLabel(id) { return G.SIZES[id] ? G.SIZES[id].label : id; }
  function pointsText(n) { return n === 1 ? '1 point' : n + ' point'; }
  function movesText(n) { return n === 1 ? '1 træk' : n + ' træk'; }
  function swapsText(n) { return n === 1 ? '1 byt' : n + ' byt'; }
  function cmText(px) { return (px / (96 / 2.54)).toFixed(1).replace('.', ','); }

  // ---------- Størrelser, skærmen kan bære ----------
  // Felterne er knapper og skal være store nok til øjenstyring (helst ca. 3 cm).
  // 7 × 7 og 8 × 8 kan kun vælges, hvis felterne bliver mindst MIN_CELL px
  // (ca. 2,6 cm). 6 × 6 kan altid vælges (på en mobil bliver felterne mindre).
  var MIN_CELL = 100;
  function availableSizes() {
    return G.SIZE_ORDER.filter(function (s) { return s === '6x6' || cellSizeFor(s) >= MIN_CELL; });
  }
  function currentMode() {
    var m = bset.get('mode'), av = availableSizes();
    if (av.indexOf(m) < 0) return av[av.length - 1];
    return m;
  }

  // ---------- Startmenu ----------
  function syncMenu() {
    var avail = availableSizes(), mode = currentMode();
    $$('#menu [data-mode]').forEach(function (b) {
      var m = b.dataset.mode;
      b.hidden = avail.indexOf(m) < 0;
      b.setAttribute('aria-pressed', String(m === mode));
    });
    $('#start-sub').textContent = sizeLabel(mode) + ' · ' + movesText(G.RULES.startMoves);
    var notes = [];
    var missing = G.SIZE_ORDER.filter(function (s) { return avail.indexOf(s) < 0; });
    if (missing.length) notes.push(missing.map(sizeLabel).join(' og ') + ' kræver en større skærm, så felterne bliver store nok.');
    var c6 = cellSizeFor('6x6');
    if (c6 < 84) notes.push('På denne skærm bliver felterne ca. ' + cmText(c6) + ' cm.' + (isFullscreen() ? '' : ' Fuld skærm giver lidt større felter.'));
    $('#size-note').textContent = notes.join(' ');
    if (current === 'menu') fitScreen($('#menu'));
  }
  $$('#menu [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set('mode', b.dataset.mode); syncMenu(); sfx('click'); });
  });
  $('#btn-start').addEventListener('click', function () { sfx('click'); startGame(); });
  $('#btn-settings').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
  $('#btn-records').addEventListener('click', function () { sfx('click'); openRecords(currentMode()); });
  // Tilbage til hallen: stop musikken og skriv indstillingerne, før siden skifter.
  function goToHall() {
    sfx('click');
    audio.setMusic(false); // stopper kun musikken nu – den gemte indstilling ændres ikke
    [arkade, bset].forEach(function (s) {
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
  var run = null, paused = false, finished = false, busy = false;
  var sel = -1, targets = [], invalid = null, tipPair = null, gone = [];
  var curIdx = -1;               // tastaturets markør (−1 = skjult)
  var boardEl = $('#board');
  var lastNote = '', noteCls = '', overTimer = 0, animToken = 0;
  var introQueue = [];           // niveau-kort, der venter på at blive vist

  // Tegningen af brættet ligger i js/tegn.js og læser kun spillets tilstand
  var tegn = JuvelerTegn.create(boardEl);

  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.cell');
    // Inerte felter (se tegn.js) får ikke selv klikket: find feltet under musen
    if (!c && e.target === boardEl && (e.clientX || e.clientY)) c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    act(+c.dataset.i);
  });

  function cellAt(x, y) {
    var cs = boardEl.querySelectorAll('.cell');
    for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return cs[i]; }
    return null;
  }
  function startGame() {
    if (window.ArkadeHighscore) ArkadeHighscore.start();
    animToken++;
    run = G.createRun(currentMode());
    paused = false; finished = false; busy = false; shownHud = null; introQueue = []; shownTask = null; shownPN = 0;
    sel = -1; targets = []; invalid = null; tipPair = null; gone = [];
    curIdx = -1; lastNote = ''; noteCls = '';
    clearTimeout(overTimer);
    tegn.build(run.n);
    hideOverlays();
    show('game');
    refresh();
  }
  var OVERLAYS = ['#pause-overlay', '#confirm-overlay', '#niveau-overlay'];
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); dwell.unguard(); }
  function overlayOpen() { return OVERLAYS.some(function (o) { return !$(o).hidden; }); }
  function confirmOpen() { return !$('#confirm-overlay').hidden; }
  function live() { return run && !paused && !finished && !run.state.over && current === 'game' && !overlayOpen(); }
  function setNote(t, cls) { lastNote = t; noteCls = cls || ''; }

  // Vælg, byt eller fortryd: alt sker med samme handling på en juvel (klik, tryk, dwell, Enter)
  function act(i) {
    if (!live() || busy || i < 0 || i >= run.n * run.n) return;
    if (curIdx >= 0) curIdx = i;
    if (sel < 0) { select(i); return; }
    if (i === sel) { deselect(true); return; }
    if (!G.adjacent(sel, i, run.n)) { if (fixedNote(i)) return; select(i); return; }
    if (run.canSwap(sel, i)) { doSwap(sel, i); return; }
    // Ugyldigt byt: forklares roligt, koster intet, og valget bliver stående
    invalid = [sel, i];
    sfx('invalid');
    var g = run.state.grid, fx = run.state.fx;
    setNote(g[i] === G.STEN ? 'En sten kan ikke byttes. Den knuses, når en juvel ved siden af forsvinder.'
      : (fx[i] & G.IS) ? 'En frossen juvel kan ikke byttes. Lav tre på stribe ved siden af den for at bryde isen.'
      : g[sel] === g[i] ? 'De to juveler er ens, så byttet ændrer ingenting. Det koster intet træk.'
      : 'Det byt giver ikke tre på stribe. Det koster intet træk – prøv en anden nabo.', 'warn');
    refresh();
  }
  // Sten og frosne juveler kan ikke vælges: forklar hvorfor (koster intet)
  function fixedNote(i) {
    var g = run.state.grid, fx = run.state.fx;
    if (g[i] !== G.STEN && !(fx[i] & G.IS)) return false;
    sel = -1; targets = []; invalid = null;
    sfx('invalid');
    setNote(g[i] === G.STEN
      ? 'Sten kan ikke flyttes. En sten knuses, når en juvel ved siden af forsvinder: +1 træk.'
      : 'Frosne juveler kan ikke flyttes, men kan godt være med i tre på stribe. Det bryder isen.', 'warn');
    refresh();
    return true;
  }
  function select(i) {
    if (fixedNote(i)) return;
    sel = i; invalid = null;
    targets = run.targets(i);
    sfx('select');
    if (!targets.length) setNote(run.state.grid[i] === G.STJERNE ? 'Stjernejuvelen har ingen nabo at bytte med. Vælg en anden, eller fortryd.' : 'Denne juvel kan ikke give tre på stribe. Vælg en anden, eller fortryd.', 'warn');
    else if (run.state.grid[i] === G.STJERNE) setNote('Vælg en nabo: alle juveler af dens slags forsvinder', '');
    else if (bset.get('visMaal')) setNote(targets.length === 1 ? 'Vælg naboen, der lyser op' : 'Vælg en af de ' + targets.length + ' naboer, der lyser op', '');
    else setNote('Vælg en nabo at bytte med', '');
    refresh();
  }
  function deselect(sound) {
    if (sel < 0) return;
    sel = -1; targets = []; invalid = null;
    if (sound) sfx('click');
    setNote('Valget er fortrudt. Vælg en juvel', '');
    refresh();
  }
  $('#btn-undo').classList.add('turn-btn');
  $('#btn-undo').addEventListener('click', function () { deselect(true); });

  function showTip() {
    if (!live() || busy) return;
    // Et tip, der allerede vises, koster ikke igen (fx ved dwell eller dobbeltklik)
    if (tipPair) { setNote('Tip: byt de to juveler med ✓', 'tipnote'); refresh(); return; }
    var t = run.tip();
    if (!t) return;
    tipPair = t.move; invalid = null;
    sfx('tip');
    setNote('Tip: byt de to juveler med ✓ (−' + pointsText(t.cost) + ')', 'tipnote');
    refresh();
  }
  $('#btn-tip').classList.add('turn-btn');
  $('#btn-tip').addEventListener('click', function () { showTip(); });

  // ---------- Byt og opløsning (med rolige animationer, hvis de er slået til) ----------
  var T_SWAP = 240, T_GONE = 300, T_FALL = 360;      // med animation
  var T_CALM_GONE = 450, T_CALM_FALL = 250;          // uden animation: faste skift med en kort pause
  function wait(ms, token) { return new Promise(function (res) { setTimeout(function () { res(token === animToken); }, ms); }); }
  var shownHud = null;
  // Kort tekst om, hvad der sker i et led af opløsningen
  function stepText(step) {
    var t = [];
    if (step.star) t.push('Stjernejuvel!');
    if (step.fired && step.fired.length) t.push(step.fired.length > 1 ? step.fired.length + ' lyn!' : 'Lyn!');
    if (step.crushed && step.crushed.length) t.push('Sten knust: +' + movesText(step.crushed.length));
    if (step.broken && step.broken.length) t.push('Is brudt');
    if (step.created && step.created.length) {
      var star = step.created.some(function (c) { return c.kind === 'stjerne'; });
      t.push(star ? 'Ny stjernejuvel' : 'Ny lynjuvel');
    }
    if (step.level > 1) t.push('Kæde: ' + step.level + ' led');
    return t.join(' · ');
  }
  function doSwap(a, b) {
    var hudBefore = hudNow();
    var res = run.swap(a, b);
    if (!res.ok) return;
    busy = true; sel = -1; targets = []; invalid = null; tipPair = null;
    // Tallene i status følger animationen: de gamle står, til juvelerne har lagt sig
    shownHud = hudBefore;
    var token = ++animToken, anim = animationOn();
    sfx('swap');
    setNote('', '');
    refresh(res.before, res.beforeFx);
    var p = Promise.resolve(true);
    if (anim) {
      tegn.animSwap(a, b, T_SWAP);
      p = wait(T_SWAP, token);
    }
    res.steps.forEach(function (step) {
      p = p.then(function (ok) {
        if (!ok) return false;
        tegn.clearMotion();
        gone = step.removed.concat(step.crushed || []);
        sfx(step.level > 1 ? 'chain' : 'match');
        setNote(stepText(step), step.level > 1 || (step.fired && step.fired.length) || step.star ? 'ok' : '');
        refresh(step.before, step.beforeFx);
        return wait(anim ? T_GONE : T_CALM_GONE, token);
      }).then(function (ok) {
        if (!ok) return false;
        gone = [];
        refresh(step.grid, step.fx);
        if (anim) tegn.animFall(step, T_FALL);
        return wait(anim ? T_FALL : T_CALM_FALL, token);
      });
    });
    p.then(function (ok) {
      if (!ok) return;
      tegn.clearMotion();
      busy = false; gone = []; shownHud = null;
      var parts = ['+' + pointsText(res.points)];
      if (res.earned) parts.push('+' + movesText(res.earned));
      if (res.chain >= 2) parts.push('kæde på ' + res.chain);
      if (res.crushed) parts.push((res.crushed === 1 ? '1 sten' : res.crushed + ' sten') + ' knust');
      if (res.ice) parts.push('is brudt');
      var txt = parts.join(' · ');
      if (res.task && res.task.done) txt = 'Opgave klaret: +' + movesText(res.task.task.reward) + '! ' + txt;
      else if (res.task && res.task.failed) txt = 'Ny opgave: ' + taskText(res.task.next) + '. ' + txt;
      if (res.earned || (res.task && res.task.done)) sfx('earn');
      setNote(txt, res.earned || (res.task && res.task.done) ? 'ok' : '');
      refresh();
      if (res.levels && res.levels.length) levelReached(res.levels);
      if (res.over) {
        sfx('over');
        setNote(overText(res.overReason), 'warn');
        refresh();
        clearTimeout(overTimer);
        overTimer = setTimeout(function () { finish('over'); }, res.overReason === 'ingen-byt' ? 2200 : 1400);
      }
    });
  }

  // ---------- Tegning ----------
  function renderBoard(grid, fx) {
    if (!run || !tegn.ready) return;
    tegn.draw(grid || run.state.grid, {
      fx: grid ? (fx || run.state.fx) : run.state.fx,
      selected: sel, targets: bset.get('visMaal') ? targets : [], dim: bset.get('visMaal'),
      invalid: invalid, tip: tipPair, gone: gone, busy: busy, cursor: live() ? curIdx : -1,
      alle: !!arkade.get('dwell')
    });
  }
  function hudNow() { var s = run.state; return { moves: s.moves, score: s.score, level: s.level, goal: s.goal }; }
  function refresh(grid, fx) {
    if (!run) return;
    var s = run.state, h = (busy && shownHud) || hudNow();
    $('#hud-moves').textContent = h.moves;
    $('.hud-traek').classList.toggle('lav', h.moves <= 5);
    $('#hud-score').textContent = h.score;
    $('#hud-goal').textContent = 'mål ' + h.goal;
    $('#hud-level').textContent = h.level;
    renderTask();
    renderPointsNote(h.level);
    var hint = $('#hint'), cls = noteCls, txt = lastNote;
    if (!txt) txt = busy ? '' : sel >= 0 ? 'Vælg en nabo at bytte med' : 'Vælg en juvel';
    hint.textContent = txt;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    $('#btn-tip').disabled = !live() || busy;
    $('#btn-undo').disabled = !live() || busy || sel < 0;
    boardEl.setAttribute('aria-label', 'Bræt ' + sizeLabel(s.size) + ', niveau ' + s.level + ', ' + movesText(s.moves) + ' tilbage');
    renderBoard(grid, fx);
    // Sikkerhedsnet: gør en ny tekst, at noget ikke kan være der, lægges skærmen om
    if (current === 'game' && !relayouting && (overflows(gameEl) || overflows(root))) { relayouting = true; layoutGame(); relayouting = false; }
  }
  var relayouting = false;

  // ---------- Niveauer, elementer og opgaver ----------
  var B = JuvelerTegn.brikHtml;
  function taskText(t) {
    if (!t) return '';
    var what = t.kind === 'fjern' ? 'fjern ' + t.goal + ' ' + (t.goal === 1 ? JuvelerTegn.typeNavn(t.type) : JuvelerTegn.typeFlertal(t.type))
      : t.kind === 'is' ? 'bryd ' + t.goal + ' is' : 'knus ' + t.goal + ' sten';
    return what + ' inden for ' + movesText(t.moves);
  }
  function taskPic(t) {
    if (!t) return JuvelerTegn.ikon('opgave');
    if (t.kind === 'fjern') return B(t.type, 0, 'mini');
    if (t.kind === 'is') return B(0, G.IS, 'mini');
    return B(G.STEN, 0, 'mini');
  }
  var shownTask = null;
  function renderTask() {
    var t = run.state.task, box = $('.hud-opgave');
    var key = t ? [t.id, t.progress, t.left, t.kind, t.type].join(':') : 'ingen:' + run.state.level;
    if (shownTask === key) return;
    shownTask = key;
    box.classList.toggle('aktiv', !!t);
    if (!t) {
      $('#hud-task').innerHTML = '–';
      $('#hud-task-sub').textContent = run.state.level < G.RULES.taskFrom ? 'fra niveau ' + G.RULES.taskFrom : '';
      box.setAttribute('aria-label', 'Opgave: ingen endnu');
      return;
    }
    $('#hud-task').innerHTML = taskPic(t) + '<span class="opg-tal">' + t.progress + '/' + t.goal + '</span>';
    $('#hud-task-sub').textContent = t.left === 1 ? '1 træk' : t.left + ' træk';
    box.setAttribute('aria-label', 'Opgave: ' + taskText(t) + '. ' + t.progress + ' af ' + t.goal + ', ' + movesText(t.left) + ' tilbage. Giver +' + movesText(t.reward) + '.');
  }
  var shownPN = 0;
  function renderPointsNote(L) {
    if (shownPN === L) return;
    shownPN = L;
    var lines = [];
    lines.push(L >= G.RULES.lynFrom ? '4 ens: lynjuvel' : '4 på stribe: +1 træk');
    lines.push(L >= G.RULES.starFrom ? '5, L eller T: stjerne' : '5, L eller T: +2 træk');
    lines.push(L >= G.RULES.stoneFrom ? 'Knust sten: +1 træk' : 'Nyt niveau: +' + G.RULES.levelMoves + ' træk');
    $('#points-note').innerHTML = lines.join('<br>');
  }
  // Kortene: billede og forklaring for hvert nyt element
  var INTRO = {
    lyn: {
      titel: 'Lynjuvel',
      pic: function () { return B(1, 0) + B(1, 0) + B(1, 0) + B(1, 0) + '<span class="pil" aria-hidden="true">→</span>' + B(1, G.LYN); },
      tekst: 'Fire ens på stribe bliver nu til en lynjuvel med et lyn på. Kommer lynjuvelen selv med i tre eller flere på stribe, fjerner lynet hele rækken (vandret stribe) eller hele kolonnen (lodret stribe).'
    },
    stjerne: {
      titel: 'Stjernejuvel',
      pic: function () { return B(2, 0) + B(2, 0) + B(2, 0) + B(2, 0) + B(2, 0) + '<span class="pil" aria-hidden="true">→</span>' + B(G.STJERNE, 0); },
      tekst: 'Fem på stribe, eller et L eller T, giver en stjernejuvel. Den har ingen farve og kan byttes med alle naboer. Så forsvinder alle juveler af naboens slags. To stjerner byttet med hinanden tømmer hele brættet.'
    },
    is: {
      titel: 'Is',
      pic: function () { return B(0, G.IS) + B(3, G.IS) + B(4, G.IS); },
      tekst: 'Nogle juveler er frosne. De kan ikke byttes, men kan godt være med i tre på stribe. Forsvinder en juvel ved siden af, eller er den frosne selv med, brydes isen: +20 point.'
    },
    sten: {
      titel: 'Sten',
      pic: function () { return B(G.STEN, 0) + B(G.STEN, 0); },
      tekst: 'Sten er faste blokke. De kan ikke byttes, men falder ned ligesom juvelerne. Forsvinder en juvel ved siden af en sten, eller rammer et lyn den, knuses stenen: +1 træk og 30 point.'
    },
    opgave: {
      titel: 'Opgaver',
      pic: function () { return '<span class="kort-ikon">' + JuvelerTegn.ikon('opgave') + '</span>' + B(1, 0) + '<span class="pil">8</span>'; },
      tekst: 'Nu får du opgaver, fx at fjerne 8 safirer inden for 5 træk. Opgaven står i status. Klarer du den, får du +' + G.RULES.taskReward + ' træk. Klarer du den ikke, sker der ingenting – du får bare en ny opgave.'
    },
    rav: {
      titel: 'Rav',
      pic: function () { return B(6, 0) + B(6, 0) + B(6, 0); },
      tekst: 'En syvende slags juvel er med fra nu af: rav, en orange dråbe. Med flere slags juveler er der færre mulige byt, så kig godt efter.'
    }
  };
  function levelReached(levels) {
    G.introEvents(levels, bset.get('introKort')).forEach(function (ev) { if (INTRO[ev.element]) introQueue.push(ev); });
    var last = levels[levels.length - 1];
    sfx('record');
    if (!introQueue.length) {
      var extra = [];
      // Introkort slået fra: de nye elementer nævnes kort (forklaringen står i Om)
      var nye = levels.filter(function (ev) { return ev.element && INTRO[ev.element]; }).map(function (ev) { return INTRO[ev.element].titel.toLowerCase(); });
      if (nye.length) extra.push('nyt: ' + nye.join(', '));
      if (!nye.length && last.ice.length) extra.push('mere is');
      if (!nye.length && last.stones.length) extra.push('flere sten');
      setNote('Niveau ' + last.level + '! +' + movesText(last.moves * levels.length) + (extra.length ? ' · ' + extra.join(' og ') : '') + (last.newBoard ? ' · nyt bræt' : ''), 'ok');
      refresh();
      return;
    }
    showIntro(introQueue.shift());
  }
  function showIntro(ev) {
    var info = INTRO[ev.element], ov = $('#niveau-overlay');
    $('#niveau-title').textContent = 'Niveau ' + ev.level + ': ' + info.titel;
    $('#niveau-pic').innerHTML = info.pic();
    $('#niveau-text').textContent = info.tekst;
    var more = '+' + movesText(ev.moves) + '. Næste mål: ' + run.state.goal + ' point.';
    if (ev.element === 'opgave' && run.state.task) more = 'Første opgave: ' + taskText(run.state.task) + '. ' + more;
    $('#niveau-more').textContent = more;
    ov.dataset.element = ev.element;
    ov.hidden = false;
    fitScreen(ov);
    dwell.reset();
    dwell.guard(ov);
    $('#btn-niveau-ok').focus({ preventScroll: true });
    refresh();
  }
  function closeIntro() {
    var ov = $('#niveau-overlay');
    if (ov.hidden) return;
    sfx('click');
    ov.hidden = true;
    dwell.unguard(); dwell.reset();
    if (introQueue.length) { showIntro(introQueue.shift()); return; }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    setNote('Niveau ' + run.state.level + ' · mål ' + run.state.goal + ' point', 'ok');
    refresh();
  }
  $('#btn-niveau-ok').addEventListener('click', closeIntro);
  function introOpen() { return !$('#niveau-overlay').hidden; }

  function setPaused(p) {
    if (!run || finished || run.state.over || introOpen()) return;
    paused = p;
    $('#pause-overlay').hidden = !p;
    if (p) fitScreen($('#pause-overlay'));
    dwell.reset();
    if (p) dwell.guard($('#pause-overlay')); else dwell.unguard();
    sfx('pause');
    refresh();
    if (p) $('#btn-resume').focus({ preventScroll: true });
  }
  $('#btn-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#btn-resume').addEventListener('click', function () { setPaused(false); });
  $('#btn-pause-settings').addEventListener('click', function () { sfx('click'); openSettings('game'); });
  $('#btn-quit').addEventListener('click', function () { sfx('click'); askQuit(); });

  // ---------- Bekræft Afslut ----------
  function askQuit() {
    if (!run || finished || run.state.over) return;
    $('#pause-overlay').hidden = true;
    var s = run.state;
    $('#confirm-text').textContent = 'Du har ' + pointsText(s.score) + ' efter ' + swapsText(s.swaps) + '. Pointene gemmes i rekorderne.';
    var ov = $('#confirm-overlay');
    ov.hidden = false;
    fitScreen(ov);
    dwell.reset();
    dwell.guard(ov);
    $('#btn-confirm-no').focus({ preventScroll: true });
  }
  function cancelQuit() {
    if (!confirmOpen()) return;
    $('#confirm-overlay').hidden = true;
    dwell.unguard();
    dwell.reset();
    sfx('click');
    paused = false;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    refresh();
  }
  $('#btn-confirm-no').addEventListener('click', cancelQuit);
  $('#btn-confirm-yes').addEventListener('click', function () { sfx('click'); dwell.unguard(); finish('quit'); });
  function quitToMenu() { animToken++; run = null; paused = false; busy = false; shownHud = null; clearTimeout(overTimer); hideOverlays(); show('menu'); }

  // ---------- Slut ----------
  function overText(reason) {
    return reason === 'ingen-byt'
      ? 'Ingen flere mulige byt på brættet.'
      : 'Trækkene er brugt.';
  }
  // Rekorder pr. brætstørrelse: point, niveau og antal byt. (Gamle rekorder har kun
  // point og byt i feltet levels – de vises uden niveau.)
  var lastEntryId = null;
  function saveRecord() {
    var s = run.state, out = run.end(), res = null;
    finished = true;
    if (window.ArkadeHighscore) ArkadeHighscore.slut();
    if (out.score > 0) res = records.add(s.size, out.score, G.recordExtra(out));
    return res;
  }
  function finish(why) {
    if (finished || !run) return;
    animToken++; busy = false; shownHud = null;
    clearTimeout(overTimer);
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
    $('#go-reason').textContent = why === 'over' ? overText(s.overReason) : 'Du afsluttede spillet.';
    var pic = '';
    for (var t = 0; t < run.k; t++) pic += B(t, 0);
    $('#go-pic').innerHTML = pic;
    $('#go-score').textContent = s.score;
    $('#go-level').textContent = 'Niveau ' + s.level;
    var bits = [swapsText(s.swaps)];
    if (s.bestChain > 1) bits.push('bedste kæde ' + s.bestChain);
    if (s.earnedTotal) bits.push(movesText(s.earnedTotal) + ' optjent');
    if (s.tasksDone) bits.push((s.tasksDone === 1 ? '1 opgave' : s.tasksDone + ' opgaver') + ' klaret');
    if (s.tips) bits.push((s.tips === 1 ? '1 tip' : s.tips + ' tip') + ' (−' + pointsText(s.tipPoints) + ')');
    $('#go-levels').textContent = bits.join(' · ');
    $('#go-rank').textContent = rankText;
    $('#go-again-sub').textContent = sizeLabel(s.size);
    $('#go-records-title').textContent = 'Rekorder – ' + sizeLabel(s.size);
    renderRecordList($('#go-records'), s.size, lastEntryId);
    show('gameover');
  }
  // Lukkes siden midt i et spil, gemmes pointene alligevel
  window.addEventListener('pagehide', function () { if (run && !finished) saveRecord(); });
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
        lv.textContent = G.recordLabel(e);
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
  var recMode = '7x7';
  function openRecords(m) { recMode = m; syncRecords(); show('records'); }
  function syncRecords() {
    $$('#records [data-rec-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.recMode === recMode)); });
    $('#rec-title').textContent = 'Rekorder – ' + sizeLabel(recMode);
    renderRecordList($('#rec-list'), recMode, null);
    if (current === 'records') fitScreen($('#records'));
  }
  $$('#records [data-rec-mode]').forEach(function (b) {
    b.addEventListener('click', function () { sfx('click'); recMode = b.dataset.recMode; syncRecords(); });
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
    $$('#settings [data-bset]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(String(bset.get(b.dataset.bset)) === b.dataset.value));
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
  $$('#settings [data-bset]').forEach(function (b) {
    b.addEventListener('click', function () { bset.set(b.dataset.bset, b.dataset.value === 'true'); sfx('click'); syncSettingsUi(); });
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
  // Piletasterne flytter markøren, Enter eller mellemrum vælger og bytter,
  // Esc, Delete eller Backspace fortryder valget (Esc uden valg giver pause),
  // T viser et tip, og P giver pause.
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function centre() { var n = run.n, c = Math.floor(n / 2); return c * n + c; }
  function moveCursor(d) {
    if (!live()) return;
    var n = run.n, i = curIdx;
    if (i < 0) i = sel >= 0 ? sel : centre();
    else {
      var x = Math.max(0, Math.min(n - 1, i % n + d[0])), y = Math.max(0, Math.min(n - 1, Math.floor(i / n) + d[1]));
      i = y * n + x;
    }
    curIdx = i;
    renderBoard();
  }
  function keyAct() {
    if (!live() || busy) return;
    if (curIdx < 0) { curIdx = sel >= 0 ? sel : centre(); renderBoard(); return; }
    act(curIdx);
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current !== 'game') { if (KEYS[e.key]) e.preventDefault(); return; }
    if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); cancelQuit(); } return; } // Esc = Nej
    if (introOpen()) { if (e.key === 'Escape') { e.preventDefault(); closeIntro(); } return; } // Enter virker på Videre
    if (e.key === 'Escape' && sel >= 0 && !paused && !overlayOpen()) { e.preventDefault(); deselect(true); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); setPaused(!paused); return; }
    if (overlayOpen()) return; // Enter og mellemrum virker på den fokuserede knap
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var handled = true;
    if (KEYS[e.key]) moveCursor(KEYS[e.key]);
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) keyAct(); }
    else if (k === 'Delete' || k === 'Backspace') deselect(true);
    else if (k === 't') { if (!e.repeat) showTip(); }
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  // Mellemrum må ikke også "klikke" en knap med fokus
  document.addEventListener('keyup', function (e) { if (current === 'game' && !overlayOpen() && e.key === ' ') e.preventDefault(); });

  // ---------- Layout: alt skal kunne ses uden at rulle ----------
  // Knapper og felter er mindst ca. 3 cm, når der er plads (samme regel som arkade.css).
  // Ellers vælges det layout, der giver de største felter, og knapperne bliver så store som muligt.
  // Brættet er n × n felter. Brættets ramme i alt (2 × temaets --jv-frame-w)
  var FRAME = 6;
  function readFrame() { FRAME = 2 * JuvelerTegn.cssNum('--jv-frame-w', 3); }
  var LAYOUTS = ['wide', 'side', 'below'];
  function viewport() { return { W: root.clientWidth || window.innerWidth, H: root.clientHeight || window.innerHeight }; }
  function cssBtn(W, H) { var cm = 96 / 2.54; return Math.max(3 * cm, Math.min(0.15 * Math.min(W, H), 4.2 * cm)); }
  function cssGap(W, H) { return Math.max(0.8 * 96 / 2.54, 0.03 * Math.min(W, H)); }
  function spacing(W, H) { var mn = Math.min(W, H); return { p: Math.max(8, mn * 0.016), g: Math.max(8, Math.min(26, mn * 0.022)) }; }
  function hintFactors() { return { rw: 0, ch: 0 }; }
  var MAX_CELL = 180;
  var NTOOLS = 3;   // Vis et tip, Fortryd valg og (i kompakt layout) Pause
  function candidates(n, b, W, H, small) {
    var d = spacing(W, H), p = d.p, g = d.g, ig = 10, hf = hintFactors(n);
    var hudH = Math.max(52, Math.min(84, b * 0.62)), hint = 60;
    function cell(aw, ah) { return Math.min(MAX_CELL, Math.floor(Math.min((aw - FRAME) / (n + hf.rw), (ah - FRAME) / (n + hf.ch)))); }
    var res = { p: p, g: g, hudH: hudH, ig: ig };
    // wide: status | gitter | tekst og værktøjer
    var sideW = Math.min(380, Math.max(230, b * 2.2));
    var leftH = 100 + 4 * hudH + 3 * ig + 70 + b + 3 * ig;
    var rightH = hint + 2 * b + 2 * ig;
    res.sideW = sideW;
    res.wide = (rightH <= H - 2 * p && leftH <= H - 2 * p) ? cell(W - 2 * p - 2 * sideW - 2 * g, H - 2 * p) : 0;
    // side: gitter | (status, tekst, værktøjer og pause i k kolonner)
    res.side = 0;
    [1, 3].forEach(function (k) {
      var panelW = Math.max(k * b + (k - 1) * ig, k === 1 ? 150 : 0);
      var hudCols = panelW >= 4 * 110 + 3 * ig ? 4 : panelW >= 2 * 110 + ig ? 2 : 1, hudRows = 4 / hudCols;
      var rows = Math.ceil(NTOOLS / k);
      var panelH = hudRows * hudH + (hudRows - 1) * ig + g + hint + ig + rows * b + (rows - 1) * ig;
      if (panelH > H - 2 * p) return;
      var c = cell(W - 2 * p - g - panelW, H - 2 * p);
      if (c > res.side) { res.side = c; res.sideK = k; res.panelSide = panelW; res.hudColsSide = hudCols; }
    });
    // below: status / gitter / tekst og værktøjer (på højkant ligger knapperne under gitteret)
    res.below = 0;
    res.belowHud = (W - 2 * p) >= 4 * 120 + 3 * ig ? 4 : 2;
    [3].forEach(function (k) {
      var needW = k * b + (k - 1) * ig;
      if (needW > W - 2 * p) return;
      var rows = Math.ceil(NTOOLS / k), hr = 4 / res.belowHud;
      var extra = hr * hudH + (hr - 1) * ig + g + hint + ig + rows * b + (rows - 1) * ig + g;
      var c = cell(W - 2 * p, H - 2 * p - extra);
      if (c > res.below) { res.below = c; res.belowK = k; }
    });
    LAYOUTS.forEach(function (l) { if (!(res[l] >= 16)) res[l] = 0; });
    return res;
  }
  function pick(res) {
    var best = null;
    LAYOUTS.forEach(function (l) { if (best === null || res[l] > res[best] * 1.04) best = l; });
    // Status og værktøjer på hver sin side er rarest på store skærme: wide vinder ved næsten lige store felter
    if (res.wide && res.wide >= res[best] * 0.92) best = 'wide';
    return best;
  }
  // Knapperne er så store som muligt (op til ca. 4 cm), men bliver mindre (dog aldrig
  // under ca. 80 px), hvis felterne på gitteret derved bliver mindst 5 % større.
  function bestFit(n, v) {
    readFrame();
    var small = isSmall(v), floor = small ? SMALL_MIN : 84;
    var b = Math.max(floor, cssBtn(v.W, v.H)), all = [];
    for (var k = 0; k < 20; k++) {
      var res = candidates(n, b, v.W, v.H, small), lay = pick(res);
      all.push({ b: b, res: res, lay: lay, cell: res[lay] || 0 });
      if (b <= floor) break;
      b = Math.max(floor, b * 0.94);
    }
    var max = 0;
    all.forEach(function (o) { if (o.cell > max) max = o.cell; });
    for (var i = 0; i < all.length; i++) if (all[i].cell >= max / 1.05) return all[i];
    return all[all.length - 1];
  }
  function cellSizeFor(sizeId) { return bestFit(G.SIZES[sizeId].n, viewport()).cell; }

  var gameEl = $('#game'), gridEl = $('#game-grid');
  var pauseBtn = $('#btn-pause'), toolsEl = $('#tools'), sideLeft = $('#side-left');
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function applyLayout(lay, b, cell, res, n, v) {
    var hf = hintFactors(n), rh = Math.round(cell * hf.rw), ch = Math.round(cell * hf.ch);
    LAYOUTS.forEach(function (l) { gridEl.classList.toggle('lay-' + l, l === lay); });
    gridEl.classList.toggle('compact', lay !== 'wide');
    // Pausen står under status i wide, ellers sammen med værktøjerne
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
    st.setProperty('--rh', rh + 'px');
    st.setProperty('--ch', ch + 'px');
    var bw = rh + n * cell + FRAME, bh = ch + n * cell + FRAME;
    st.setProperty('--board-w', bw + 'px');
    st.setProperty('--board-h', bh + 'px');
    var panelW, toolCols, hudCols;
    if (lay === 'wide') { panelW = res.sideW; toolCols = 1; hudCols = 1; }
    else if (lay === 'side') { panelW = res.panelSide; toolCols = res.sideK; hudCols = res.hudColsSide; }
    else { toolCols = res.belowK; panelW = Math.min(v.W - 2 * res.p, Math.max(bw, toolCols * b + (toolCols - 1) * res.ig)); hudCols = res.belowHud; }
    st.setProperty('--panel-w', Math.floor(panelW) + 'px');
    st.setProperty('--tool-cols', toolCols);
    st.setProperty('--hud-cols', hudCols);
    gameEl.dataset.layout = lay;
    gameEl.dataset.cell = cell;
  }
  function layoutGame() {
    if (current !== 'game' || !run) return;
    var v = viewport(), n = run.n, small = isSmall(v);
    var floor = small ? SMALL_MIN : 84;
    var best = bestFit(n, v), b = best.b, lay, res, cell;
    for (var k = 0; k < 24; k++) {
      if (k === 0) { res = best.res; lay = best.lay; cell = best.cell; }
      else { res = candidates(n, b, v.W, v.H, small); lay = pick(res); cell = res[lay]; }
      if (!cell && b > floor) { b = Math.max(floor, b * 0.93); continue; }
      cell = Math.max(16, cell || 16);
      applyLayout(lay, b, cell, res, n, v);
      // Passer det ikke helt (fx lange tekster), så mindre felter, og derefter mindre knapper
      for (var t = 0; t < 12 && (overflows(gameEl) || overflows(root)) && cell > 16; t++) {
        cell = Math.max(16, Math.floor(cell * 0.96));
        applyLayout(lay, b, cell, res, n, v);
      }
      if (!overflows(gameEl) && !overflows(root)) break;
      if (b <= floor) break;
      b = Math.max(floor, b * 0.93);
    }
    $$('#game .overlay').forEach(function (o) { if (!o.hidden) fitScreen(o); });
  }

  // ---------- Små skærme ----------
  // Er vinduets korte side under 560 px (fx mobil på langs og på højkant), er
  // det en lille skærm. Her bliver knapperne aldrig mindre end SMALL_MIN, og der
  // zoomes ikke. Er der ikke plads, deles skærmen i stedet op i flere sider.
  var SMALL_MIN = 84, SMALL_SIDE = 560;
  function isSmall(v) { v = v || viewport(); return Math.min(v.W, v.H) < SMALL_SIDE; }
  function syncSmall() {
    var v = viewport(), small = isSmall(v);
    root.classList.toggle('jv-lille', small);
    root.classList.toggle('jv-tvaers', small && v.W > v.H);
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
      var host = (opts.navBottom && !root.classList.contains('jv-tvaers')) ? opts.navBottom : opts.navIn;
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
    var minB = small ? SMALL_MIN : 84;   // hellere flere sider end knapper under 80 px
    if (base < minB) { base = minB; el.style.setProperty('--btn', base + 'px'); }
    var fits = function () {
      if (overflows(box)) return false;
      if (el.id === 'menu' && !root.classList.contains('jv-tvaers')) {
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
    resizeTimer = setTimeout(fitCurrent, 150); // fx når adresselinjen på mobil skjules
  });


  // ---------- Start ----------
  JuvelerTegn.installerGrafik();
  // Billederne i Om-teksten (samme brikker som på brættet)
  var OM_PIC = { lyn: function () { return B(1, G.LYN); }, stjerne: function () { return B(G.STJERNE, 0); }, is: function () { return B(0, G.IS); },
    sten: function () { return B(G.STEN, 0); }, opgave: function () { return '<span class="kort-ikon">' + JuvelerTegn.ikon('opgave') + '</span>'; }, rav: function () { return B(6, 0); } };
  $$('[data-om]').forEach(function (el) { el.innerHTML = OM_PIC[el.dataset.om](); });
  syncSmall();
  applyGlow();
  applyTheme();
  applyBackground();
  applyAnimation();
  syncFullscreen();
  syncSettingsUi();
  show('menu');

  // Til test og fejlfinding
  window.Juveler = {
    mode: currentMode, availableSizes: availableSizes, askQuit: askQuit, cancelQuit: cancelQuit,
    get guard() { return dwell.guarded ? dwell.guarded.id : null; },
    get run() { return run; }, get cursor() { return curIdx; }, get selected() { return sel; },
    get targets() { return targets.slice(); }, get busy() { return busy; }, get invalid() { return invalid; }, get tip() { return tipPair; },
    settings: arkade, gameSettings: bset, records: records, dwell: dwell, audio: audio,
    start: startGame, show: show, act: act, tipAction: showTip, deselect: deselect,
    finish: finish, refresh: refresh, cellSizeFor: cellSizeFor,
    setPaused: setPaused, layout: layoutGame,
    // Niveauer: spring til et niveau (viser kortene), vis ét kort, luk kortet
    levelUp: function (L) { var evs = run._level(L); levelReached(evs); return evs; },
    showIntro: function (element, level) { showIntro({ element: element, level: level || 2, moves: G.RULES.levelMoves }); },
    closeIntro: closeIntro, get introOpen() { return introOpen(); },
    // Læg et bræt ind i testnotation (se JuvelerGame.parse)
    load: function (rows, moves, score, level) {
      var p = G.parse(rows); run._load(p.grid, moves, score, p.fx);
      if (level) { run.state.level = level; run.state.goal = G.goal(level, run.n); setNote('Niveau ' + level + ' · mål ' + run.state.goal + ' point', 'ok'); }
      sel = -1; targets = []; invalid = null; tipPair = null; refresh(); }
  };
})();
