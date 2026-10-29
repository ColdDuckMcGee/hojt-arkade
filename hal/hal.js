/*
 * Hojt Arkade – hallen (forsiden).
 * Én arkademaskine ad gangen. Spillene kommer fra games.js (window.HOJT_SPIL).
 * Genbruger arkade/settings.js, dwell.js, audio.js og background.js.
 * Intet skifter af sig selv: maskinen skifter kun, når man vælger en pil.
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- Farvetemaer til maskinerne ----------
  var FARVER = {
    'pink':   ['#ff2fd2', '#22eaff'],
    'cyan':   ['#22eaff', '#ff2fd2'],
    'orange': ['#ff8a1f', '#ffd23a'],
    'gul':    ['#ffd23a', '#ff2f8f'],
    'grøn':   ['#39ff6a', '#22eaff'],
    'lilla':  ['#b07bff', '#ff2fd2'],
    'blå':    ['#2a9dff', '#39ff6a'],
    'rød':    ['#ff4f6d', '#ffd23a']
  };
  function farver(navn) {
    if (FARVER[navn]) return FARVER[navn];
    if (/^#[0-9a-f]{3,8}$/i.test(navn || '')) return [navn, '#22eaff'];
    return FARVER.pink;
  }

  // ---------- Data ----------
  var SPIL = (window.HOJT_SPIL || []).filter(function (g) { return g && g.navn && g.sti; }).map(function (g) {
    var sti = String(g.sti);
    return {
      navn: String(g.navn),
      sti: sti,
      url: /\/$/.test(sti) ? sti + 'index.html' : sti,
      id: sti.replace(/\/(index\.html)?$/, '').split('/').pop().toLowerCase(),
      farve: farver(g.farve),
      aktiv: g.status === 'aktiv',
      tekst: String(g.tekst || ''),
      skaerm: g.skaerm || ''
    };
  });

  // ---------- Indstillinger (fælles for alle spil) ----------
  var arkade = ArkadeSettings.create('arkade', {
    dwell: false, dwellTime: 1.2, theme: 'neon', background: 'mork', animation: true, sound: true, music: true
  });
  var hal = ArkadeSettings.create('hal', { valgt: '' });
  var root = document.documentElement;
  // Samme nøgler og værdier som i spillene (se slangen/js/app.js).
  var THEMES = ['neon', 'solnedgang', 'cyberpunk', 'kontrast'];
  var BACKGROUNDS = ['mork', 'solnedgang', 'neonby'];
  if (THEMES.indexOf(arkade.get('theme')) < 0) arkade.set('theme', 'neon');
  if (BACKGROUNDS.indexOf(arkade.get('background')) < 0) arkade.set('background', 'mork');

  var dwell = ArkadeDwell.create({ enabled: arkade.get('dwell'), timeMs: arkade.get('dwellTime') * 1000 });
  var audio = ArkadeAudio.create({ sfx: arkade.get('sound'), music: arkade.get('music') });
  function unlock() { audio.unlock(); }
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('click', unlock, { once: true }); // TD Browse m.fl. kan klikke uden pointerdown
  document.addEventListener('keydown', unlock, { once: true });

  var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- Tema og baggrund (fælles for alle spil) ----------
  var bg = ArkadeBackground.create($('#baggrund'));
  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  function animationOn() { return arkade.get('animation') && !reducedMotion.matches; }
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
    var note = $('#motion-note');
    if (note) note.textContent = reducedMotion.matches
      ? 'Slået fra, fordi din computer er sat til mindre bevægelse'
      : 'Langsom bevægelse i baggrunden';
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', applyAnimation);
  applyTheme(); applyBackground(); applyAnimation();

  // ---------- Valgt maskine ----------
  var index = 0;
  (function startIndex() {
    var m = /[?&]spil=([^&#]+)/.exec(location.search);
    var want = m ? decodeURIComponent(m[1]).toLowerCase() : hal.get('valgt');
    var i = SPIL.findIndex(function (g) { return g.id === want; });
    if (i < 0) i = Math.max(0, SPIL.findIndex(function (g) { return g.aktiv; }));
    index = i;
  })();

  // ---------- Tegning af maskinen (SVG) ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function maskineSvg(g) {
    var c1 = g.farve[0], c2 = g.farve[1], on = g.aktiv;
    var navn = esc(g.navn.toUpperCase());
    var lang = g.navn.length > 9;
    var tl = lang ? ' textLength="262" lengthAdjust="spacingAndGlyphs"' : '';
    var fs = lang ? 38 : 44;

    var skaerm;
    if (on && g.skaerm) {
      skaerm = '<image href="' + esc(g.skaerm) + '" x="78" y="172" width="244" height="222" preserveAspectRatio="xMidYMid slice"/>';
    } else if (on) {
      skaerm = '<rect x="78" y="172" width="244" height="222" fill="#0a0414"/>' +
        '<text x="200" y="276" text-anchor="middle" class="mk-skrift" font-size="30" fill="' + c1 + '">' + navn + '</text>' +
        '<text x="200" y="316" text-anchor="middle" class="mk-skrift" font-size="18" fill="#ffffff">KLAR TIL SPIL</text>';
    } else {
      skaerm = '<rect x="78" y="172" width="244" height="222" fill="url(#mk-sluk)"/>';
    }

    var skilt = on ? '' :
      '<g class="mk-skilt" transform="rotate(-4 200 284)">' +
        '<rect x="88" y="232" width="224" height="104" rx="8" fill="#000" opacity=".45" transform="translate(5 7)"/>' +
        '<rect x="88" y="232" width="224" height="104" rx="8" fill="#ffd23a" stroke="#3a2400" stroke-width="4"/>' +
        '<rect x="98" y="242" width="204" height="84" rx="4" fill="none" stroke="#3a2400" stroke-width="2" stroke-dasharray="8 6"/>' +
        '<rect x="104" y="222" width="46" height="18" fill="#f3ead2" opacity=".85" transform="rotate(-12 127 231)"/>' +
        '<rect x="252" y="222" width="46" height="18" fill="#f3ead2" opacity=".85" transform="rotate(10 275 231)"/>' +
        '<text x="200" y="276" text-anchor="middle" class="mk-skrift" font-size="32" fill="#241400">KOMMER</text>' +
        '<text x="200" y="314" text-anchor="middle" class="mk-skrift" font-size="32" fill="#241400">SNART</text>' +
      '</g>';

    return '' +
    '<svg viewBox="0 0 400 760" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<linearGradient id="mk-krop" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#05030a"/><stop offset=".07" stop-color="#1d1130"/><stop offset=".5" stop-color="#2a1842"/>' +
        '<stop offset=".93" stop-color="#1d1130"/><stop offset="1" stop-color="#05030a"/></linearGradient>' +
      '<linearGradient id="mk-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2456"/><stop offset="1" stop-color="#1a0e2a"/></linearGradient>' +
      '<linearGradient id="mk-marquee" x1="0" y1="0" x2="0" y2="1">' +
        (on ? '<stop offset="0" stop-color="#2a0c38"/><stop offset=".5" stop-color="#4a1a5a"/><stop offset="1" stop-color="#2a0c38"/>'
            : '<stop offset="0" stop-color="#1a1022"/><stop offset=".5" stop-color="#241a30"/><stop offset="1" stop-color="#1a1022"/>') +
      '</linearGradient>' +
      '<radialGradient id="mk-crt" cx=".5" cy=".5" r=".7"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>' +
      '<linearGradient id="mk-sluk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151320"/><stop offset=".5" stop-color="#07060c"/><stop offset="1" stop-color="#0d0b14"/></linearGradient>' +
      '<linearGradient id="mk-glas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<pattern id="mk-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".22"/></pattern>' +
      '<clipPath id="mk-clip"><rect x="78" y="172" width="244" height="222" rx="18"/></clipPath>' +
      '<filter id="mk-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="mk-skin" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>' +
    '</defs>' +
    // skygge på gulvet
    '<ellipse cx="200" cy="748" rx="200" ry="12" fill="#000" opacity=".7"/>' +
    // lysskær bag maskinen
    (on ? '<rect x="40" y="40" width="320" height="380" rx="30" fill="' + c1 + '" opacity=".16" filter="url(#mk-skin)"/>' : '') +
    // krop og T-liste
    '<path d="M40 30H360V742H40Z" fill="url(#mk-krop)"/>' +
    '<path d="M40 30H360V742H40Z" fill="none" stroke="' + c1 + '" stroke-width="5" opacity="' + (on ? '.95' : '.55') + '"/>' +
    '<rect x="32" y="16" width="336" height="20" rx="5" fill="#140a20" stroke="' + c1 + '" stroke-width="3" opacity=".95"/>' +
    // marquee
    '<rect x="48" y="42" width="304" height="94" rx="6" fill="#07040c"/>' +
    '<rect x="56" y="50" width="288" height="78" rx="4" fill="url(#mk-marquee)"/>' +
    '<path d="M64 60H336M64 118H336" stroke="' + c2 + '" stroke-width="3" opacity="' + (on ? '.85' : '.3') + '"/>' +
    (on
      ? '<text x="200" y="' + (lang ? 103 : 105) + '" text-anchor="middle" class="mk-skrift" font-size="' + fs + '" fill="none" stroke="' + c1 + '" stroke-width="7" filter="url(#mk-glow)"' + tl + '>' + navn + '</text>' +
        '<text x="200" y="' + (lang ? 103 : 105) + '" text-anchor="middle" class="mk-skrift" font-size="' + fs + '" fill="#fff6fd"' + tl + '>' + navn + '</text>'
      : '<text x="200" y="' + (lang ? 103 : 105) + '" text-anchor="middle" class="mk-skrift" font-size="' + fs + '" fill="#8d7aa3" stroke="' + c1 + '" stroke-opacity=".35" stroke-width="1.5"' + tl + '>' + navn + '</text>') +
    // højttalergitter
    '<g stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M150 143h100"/></g>' +
    // bezel og skærm
    '<rect x="50" y="150" width="300" height="270" rx="10" fill="#06030b"/>' +
    '<rect x="60" y="158" width="280" height="254" rx="14" fill="none" stroke="' + c2 + '" stroke-width="2" opacity="' + (on ? '.6' : '.25') + '"/>' +
    '<g clip-path="url(#mk-clip)">' + skaerm +
      (on ? '<rect x="78" y="172" width="244" height="222" fill="url(#mk-scan)"/>' : '') +
      '<rect x="78" y="172" width="244" height="222" fill="url(#mk-crt)"/>' +
      '<path d="M78 172H250L78 330Z" fill="url(#mk-glas)"/>' +
    '</g>' +
    '<rect x="78" y="172" width="244" height="222" rx="18" fill="none" stroke="#000" stroke-width="4"/>' +
    skilt +
    // kontrolpanel
    '<path d="M44 428H356L390 470H10Z" fill="url(#mk-panel)" stroke="#000" stroke-width="2"/>' +
    '<rect x="10" y="470" width="380" height="42" rx="3" fill="#120a1c" stroke="' + c1 + '" stroke-width="4" opacity=".95"/>' +
    '<ellipse cx="120" cy="452" rx="24" ry="8" fill="#000"/>' +
    '<rect x="116" y="416" width="8" height="36" rx="3" fill="#cfc8d8"/>' +
    '<circle cx="120" cy="412" r="14" fill="' + c1 + '"/><circle cx="115" cy="407" r="4.5" fill="#fff" opacity=".65"/>' +
    '<g stroke="#000" stroke-width="2">' +
      '<ellipse cx="214" cy="454" rx="15" ry="7" fill="' + c2 + '"/>' +
      '<ellipse cx="256" cy="446" rx="15" ry="7" fill="' + c1 + '"/>' +
      '<ellipse cx="298" cy="454" rx="15" ry="7" fill="#ffd23a"/>' +
    '</g>' +
    '<rect x="186" y="434" width="16" height="7" rx="2" fill="#fff" opacity=".7"/><rect x="310" y="434" width="16" height="7" rx="2" fill="#fff" opacity=".7"/>' +
    // striber
    '<path d="M44 540H356" stroke="' + c1 + '" stroke-width="6" opacity="' + (on ? '.75' : '.35') + '"/>' +
    '<path d="M44 552H356" stroke="' + c2 + '" stroke-width="3" opacity="' + (on ? '.75' : '.35') + '"/>' +
    // møntindkast
    '<rect x="132" y="576" width="136" height="112" rx="8" fill="#1a1426" stroke="#43385a" stroke-width="3"/>' +
    '<g>' +
      '<rect x="152" y="592" width="38" height="54" rx="4" fill="#09070d" stroke="#5a4e70" stroke-width="2"/>' +
      '<rect x="210" y="592" width="38" height="54" rx="4" fill="#09070d" stroke="#5a4e70" stroke-width="2"/>' +
      '<rect x="159" y="600" width="24" height="16" rx="2" fill="' + (on ? '#ff5a2a' : '#3a1a16') + '"/>' +
      '<rect x="217" y="600" width="24" height="16" rx="2" fill="' + (on ? '#ff5a2a' : '#3a1a16') + '"/>' +
      '<rect x="169" y="624" width="4" height="16" rx="1" fill="#000"/><rect x="227" y="624" width="4" height="16" rx="1" fill="#000"/>' +
      '<text x="171" y="612" text-anchor="middle" class="mk-skrift" font-size="9" fill="#1a0400">5 KR</text>' +
      '<text x="229" y="612" text-anchor="middle" class="mk-skrift" font-size="9" fill="#1a0400">5 KR</text>' +
      '<rect x="160" y="658" width="22" height="16" rx="2" fill="#09070d"/><rect x="218" y="658" width="22" height="16" rx="2" fill="#09070d"/>' +
    '</g>' +
    // fodliste
    '<rect x="40" y="706" width="320" height="36" fill="#07040b"/>' +
    '<path d="M40 706H360" stroke="' + c1 + '" stroke-width="3" opacity=".6"/>' +
    '</svg>';
  }

  // ---------- Visning ----------
  var maskineEl = $('#maskine');
  var spilBtn = $('#btn-spil');

  // Tæller under maskinen, fx "14 / 23", med en tynd linje for, hvor langt man er.
  // Kun visning (aria-hidden i index.html); skærmlæsere får det via #hal-status.
  // Virker med vilkårligt mange spil, i modsætning til de tidligere prikker.
  var taellerEl = $('#taeller');
  taellerEl.innerHTML =
    '<span class="taeller-tal"><span class="taeller-nu"></span><span class="taeller-ialt"></span></span>' +
    '<span class="taeller-linje"><span class="taeller-fyld"></span></span>';

  function render(animer) {
    var g = SPIL[index];
    if (!g) return;
    var n = SPIL.length;
    maskineEl.innerHTML = maskineSvg(g);
    maskineEl.style.setProperty('--m1', g.farve[0]);
    maskineEl.style.setProperty('--m2', g.farve[1]);
    maskineEl.setAttribute('aria-label', g.aktiv
      ? 'Arkademaskine med ' + g.navn + '. Skærmen viser et billede fra spillet.'
      : 'Arkademaskine med ' + g.navn + '. Skærmen er slukket, og der hænger et skilt: Kommer snart.');
    maskineEl.classList.remove('skift');
    if (animer && !(reducedMotion && reducedMotion.matches)) {
      void maskineEl.offsetWidth;
      maskineEl.classList.add('skift');
    }

    $('#info-navn').textContent = g.navn;
    $('#info-tekst').textContent = g.tekst;
    var status = $('#info-status');
    status.textContent = 'Spil ' + (index + 1) + ' af ' + n + ' · ' + (g.aktiv ? 'Klar til at spille' : 'Kommer snart');
    status.classList.toggle('snart', !g.aktiv);

    $('.taeller-nu', taellerEl).textContent = String(index + 1);
    $('.taeller-ialt', taellerEl).textContent = ' / ' + n;
    $('.taeller-fyld', taellerEl).style.width = (n > 1 ? ((index + 1) / n) * 100 : 100) + '%';

    if (g.aktiv) {
      spilBtn.setAttribute('href', g.url);
      spilBtn.removeAttribute('aria-disabled');
      spilBtn.removeAttribute('role');
      spilBtn.classList.remove('snart');
      spilBtn.setAttribute('aria-label', 'Spil ' + g.navn);
      $('#spil-label').textContent = 'Spil';
    } else {
      spilBtn.removeAttribute('href');
      spilBtn.setAttribute('role', 'link');
      spilBtn.setAttribute('aria-disabled', 'true');
      spilBtn.classList.add('snart');
      spilBtn.setAttribute('aria-label', g.navn + ' kommer snart og kan ikke spilles endnu');
      $('#spil-label').textContent = 'Kommer snart';
    }

    var forrige = SPIL[(index - 1 + n) % n], naeste = SPIL[(index + 1) % n];
    $('#btn-forrige').setAttribute('aria-label', 'Forrige spil: ' + forrige.navn);
    $('#btn-naeste').setAttribute('aria-label', 'Næste spil: ' + naeste.navn);

    $('#hal-status').textContent = g.navn + '. Spil ' + (index + 1) + ' af ' + n + '. ' +
      (g.aktiv ? 'Klar til at spille.' : 'Kommer snart.');
    if (typeof fit === 'function' && current === 'hal') fit();
  }

  function ga(delta) {
    if (!SPIL.length) return;
    index = (index + delta + SPIL.length) % SPIL.length;
    hal.set('valgt', SPIL[index].id);
    audio.play('move');
    render(true);
  }
  function spil() {
    var g = SPIL[index];
    if (!g || !g.aktiv) return;
    audio.play('click');
    location.href = g.url;
  }

  $('#btn-forrige').addEventListener('click', function () { ga(-1); });
  $('#btn-naeste').addEventListener('click', function () { ga(1); });
  spilBtn.addEventListener('click', function (e) {
    if (!SPIL[index] || !SPIL[index].aktiv) { e.preventDefault(); return; }
    audio.play('click');
  });

  // ---------- Passer til vinduet ----------
  // CSS'en (hal.css) skalerer alt efter vinduet med dvh/vmin og skifter layout på
  // højkant. Hvis den synlige skærm alligevel er for stor (fx meget lille vindue
  // eller stor systemskrift), skrues --fit ned i små trin – ned til 0,8 – så der
  // aldrig skal rulles. Knapper og tekst bliver da lidt mindre, men stadig læselige.
  var FIT_MIN = 0.8;
  function fit() {
    var el = $('#' + current);
    if (!el) return;
    var f = 1;
    root.style.setProperty('--fit', '1');
    function over() { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
    while (over() && f > FIT_MIN + 0.001) {
      f = Math.max(FIT_MIN, Math.round((f - 0.04) * 100) / 100);
      root.style.setProperty('--fit', String(f));
    }
    root.dataset.fit = String(f);
  }
  var fitTimer = null;
  window.addEventListener('resize', function () { clearTimeout(fitTimer); fitTimer = setTimeout(fit, 60); });

  // ---------- Skærme ----------
  var current = 'hal', returnFocus = null;
  function show(id, focusEl) {
    $$('.screen').forEach(function (el) { el.hidden = el.id !== id; });
    current = id;
    fit();
    dwell.reset();
    if (focusEl) focusEl.focus({ preventScroll: true });
  }
  $('#btn-om').addEventListener('click', function () {
    audio.play('click'); returnFocus = this; show('om', $('#om .js-tilbage'));
  });
  $('#btn-indstillinger').addEventListener('click', function () {
    audio.play('click'); returnFocus = this; syncSettings(); show('indstillinger', $('#indstillinger .js-tilbage'));
  });
  function tilbage() { audio.play('click'); show('hal', returnFocus); }
  $$('.js-tilbage').forEach(function (b) { b.addEventListener('click', tilbage); });

  // ---------- Indstillinger ----------
  function fmtSeconds(v) { return v.toFixed(v * 10 % 1 === 0 ? 1 : 2).replace('.', ',') + ' sek.'; }
  var settingsTab = 'styring';
  function syncSettings() {
    $$('#indstillinger [data-tab]').forEach(function (b) {
      var on = b.dataset.tab === settingsTab;
      b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on));
    });
    $$('#indstillinger [data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== settingsTab; });
    $$('#indstillinger [data-set]').forEach(function (b) {
      var cur = arkade.get(b.dataset.set);
      b.setAttribute('aria-pressed', String(String(cur) === b.dataset.value));
    });
    var t = arkade.get('dwellTime');
    $('#dwell-value').textContent = fmtSeconds(t);
    $('#dwell-minus').disabled = t <= 0.5 + 1e-9;
    $('#dwell-plus').disabled = t >= 3 - 1e-9;
  }
  $$('#indstillinger [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { audio.play('click'); settingsTab = b.dataset.tab; syncSettings(); fit(); });
  });
  $$('#indstillinger [data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.value;
      arkade.set(b.dataset.set, v === 'true' ? true : v === 'false' ? false : v);
      audio.play('click');
    });
  });
  function stepDwell(d) {
    var v = Math.min(3, Math.max(0.5, Math.round((arkade.get('dwellTime') + d) * 100) / 100));
    arkade.set('dwellTime', v);
    audio.play('click');
  }
  $('#dwell-minus').addEventListener('click', function () { stepDwell(-0.25); });
  $('#dwell-plus').addEventListener('click', function () { stepDwell(0.25); });
  arkade.onChange(function (key, value) {
    if (key === 'dwell') dwell.setEnabled(value);
    if (key === 'dwellTime') dwell.setTime(value * 1000);
    if (key === 'sound') audio.setSfx(value);
    if (key === 'music') { audio.unlock(); audio.setMusic(value); }
    if (key === 'theme') applyTheme();
    if (key === 'background') applyBackground();
    if (key === 'animation') applyAnimation();
    syncSettings();
  });

  // ---------- Tastatur ----------
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (current === 'hal') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ga(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ga(1); }
      else if (e.key === 'Enter') {
        var a = document.activeElement;
        if (!a || a === document.body || !a.closest('button, a[href]')) { e.preventDefault(); spil(); }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault(); tilbage();
    }
  });

  // ---------- Fuld skærm ----------
  var fsBtn = $('#btn-fs');
  var fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (!fsOk) fsBtn.hidden = true;
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  fsBtn.addEventListener('click', function () {
    audio.play('click');
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { var p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(function () {}); }
  });
  function syncFs() { $('.js-fs-label').textContent = isFs() ? 'Luk fuld skærm' : 'Fuld skærm'; }
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);

  // ---------- Start ----------
  syncSettings();
  render(false);
  fit();

  // Til test og fejlfinding (påvirker ikke almindelig brug)
  window.HojtHal = {
    spil: SPIL, settings: arkade, dwell: dwell, bg: bg, audio: audio, show: show, ga: ga, fit: fit,
    get index() { return index; }
  };
})();
