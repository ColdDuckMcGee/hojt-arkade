/*
 * Juveler – tegnelaget. Læser kun spillets tilstand (fra game.js) og bygger
 * brættet i DOM'en. Kender ingen farver: udseendet kommer fra klasser og
 * CSS-variabler i det aktive tema, og juveler og ikoner hentes ved navn fra
 * temaets grafik.js (window.JuvelerTema).
 *
 * Felterne (.cell) er knapper med én juvel (.jv[data-type=<navn>]). Særlige brikker:
 * stjernejuvel (data-type="stjerne"), sten (data-type="sten"). Mærker lægges oven på
 * juvelen i samme .jv: lyn (.jv.lyn med #jv-mark-lyn) og is (.jv.frossen med #jv-mark-is).
 * Felter med sten eller is får klasserne sten / frossen.
 * Klasser på felterne: valgt · maal (gyldigt byt med den valgte) · daempet
 * (kan ikke byttes med den valgte) · ugyldig (forsøgt byt uden tre på stribe) ·
 * tip (et muligt byt) · cur (tastaturets markør) · vaek (forsvinder).
 *
 * Animationer (kun når de er slået til): byt, forsvind og fald. Varigheden gives
 * af app.js; uden animation skifter alt med det samme.
 */
(function (global) {
  'use strict';
  var T = global.JuvelerTema;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var GAME = global.JuvelerGame, TYPES = GAME.TYPES;

  // Temaets grafik lægges ind som <symbol id="jv-juvel-<navn>"> og <symbol id="jv-ikon-<navn>">
  function installerGrafik(doc) {
    doc = doc || document;
    if (doc.getElementById('jv-grafik')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'jv-grafik';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'jv-grafik');
    var html = '';
    Object.keys(T.juveler).forEach(function (navn) {
      html += '<symbol id="jv-juvel-' + navn + '" viewBox="0 0 100 100">' + T.juveler[navn] + '</symbol>';
    });
    Object.keys(T.maerker || {}).forEach(function (navn) {
      html += '<symbol id="jv-mark-' + navn + '" viewBox="0 0 100 100">' + T.maerker[navn] + '</symbol>';
    });
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="jv-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  // Navnet på brikken i et felt (en juveltype, 'stjerne', 'sten' eller '' for tomt)
  function brikNavn(t) { return t >= 0 ? TYPES[t] : t === GAME.STJERNE ? 'stjerne' : t === GAME.STEN ? 'sten' : ''; }
  // Hele tegningen af en brik: juvel/stjerne/sten + evt. lyn- og is-mærke
  function juvelSvg(type, fx) {
    var navn = brikNavn(type);
    if (!navn) return '';
    var h = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#jv-juvel-' + navn + '"/></svg>';
    if (fx & GAME.LYN) h += '<svg class="mark-lyn" viewBox="0 0 100 100" aria-hidden="true"><use href="#jv-mark-lyn"/></svg>';
    if (fx & GAME.IS) h += '<svg class="mark-is" viewBox="0 0 100 100" aria-hidden="true"><use href="#jv-mark-is"/></svg>';
    return h;
  }
  // En lille brik til tekster, kort og status: <span class="jv ..." data-type=...>
  function brikHtml(type, fx, cls) {
    var navn = brikNavn(type);
    return '<span class="jv' + (cls ? ' ' + cls : '') + (fx & GAME.LYN ? ' lyn' : '') + (fx & GAME.IS ? ' frossen' : '') + '" data-type="' + navn + '">' + juvelSvg(type, fx) + '</span>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  // Danske navne til skærmlæser og beskeder
  var NAVNE = { rubin: 'rubin', safir: 'safir', smaragd: 'smaragd', topas: 'topas', ametyst: 'ametyst', opal: 'opal', rav: 'rav' };
  var FLERTAL = { rubin: 'rubiner', safir: 'safirer', smaragd: 'smaragder', topas: 'topaser', ametyst: 'ametyster', opal: 'opaler', rav: 'rav' };
  var FORMER = { rubin: 'rombe', safir: 'cirkel', smaragd: 'ottekant', topas: 'trekant', ametyst: 'sekskant', opal: 'stjerne', rav: 'dråbe' };
  function typeNavn(t) { return NAVNE[TYPES[t]] || ''; }
  function typeFlertal(t) { return FLERTAL[TYPES[t]] || ''; }
  function typeForm(t) { return FORMER[TYPES[t]] || ''; }
  // Skærmlæserens navn på et felt
  function feltNavn(t, fx) {
    if (t === GAME.STEN) return 'sten';
    if (t === GAME.STJERNE) return 'stjernejuvel';
    if (t < 0) return 'tomt';
    var s = typeNavn(t) + ' (' + typeForm(t) + ')';
    if (fx & GAME.LYN) s = 'lyn-' + s;
    if (fx & GAME.IS) s = 'frossen ' + s;
    return s;
  }

  function create(boardEl) {
    var cells = [], jewels = [], n = 0, shown = [];
    function build(size) {
      n = size;
      boardEl.innerHTML = '';
      boardEl.style.setProperty('--n', n);
      cells = []; jewels = []; shown = [];
      for (var i = 0; i < n * n; i++) {
        var b = document.createElement('button');
        var x = i % n, y = Math.floor(i / n);
        b.type = 'button';
        b.className = 'cell turn-btn' + ((x + y) % 2 ? ' mork' : '');
        b.dataset.i = i;
        var j = document.createElement('span');
        j.className = 'jv';
        b.appendChild(j);
        var mk = document.createElement('span');
        mk.className = 'mk';
        mk.setAttribute('aria-hidden', 'true');
        b.appendChild(mk);
        boardEl.appendChild(b);
        cells.push(b); jewels.push(j); shown.push(null);
      }
    }
    function setJewel(i, t, f) {
      f = f || 0;
      var key = t + ':' + f;
      if (shown[i] === key) return;
      shown[i] = key;
      var j = jewels[i], navn = brikNavn(t);
      j.classList.toggle('lyn', !!(f & GAME.LYN));
      j.classList.toggle('frossen', !!(f & GAME.IS));
      cells[i].classList.toggle('frossen', !!(f & GAME.IS));
      cells[i].classList.toggle('sten', t === GAME.STEN);
      if (!navn) { j.innerHTML = ''; j.removeAttribute('data-type'); return; }
      j.dataset.type = navn;
      j.innerHTML = juvelSvg(t, f);
    }
    // view: { selected, targets: [], dim: bool, invalid: [a, b] | null, tip: [a, b] | null, cursor, gone: [], busy, fx: [] }
    function draw(grid, view) {
      view = view || {};
      var targets = view.targets || [], gone = view.gone || [], invalid = view.invalid || [], tip = view.tip || [];
      var sel = view.selected === undefined ? -1 : view.selected;
      boardEl.classList.toggle('har-valg', sel >= 0);
      boardEl.classList.toggle('travl', !!view.busy);
      for (var i = 0; i < cells.length; i++) {
        setJewel(i, grid[i], view.fx ? view.fx[i] : 0);
        var cl = cells[i].classList, isT = targets.indexOf(i) >= 0;
        cl.toggle('valgt', i === sel);
        cl.toggle('maal', isT);
        cl.toggle('daempet', sel >= 0 && !!view.dim && i !== sel && !isT);
        cl.toggle('ugyldig', invalid.indexOf(i) >= 0);
        cl.toggle('tip', tip.indexOf(i) >= 0);
        cl.toggle('cur', i === view.cursor);
        cl.toggle('vaek', gone.indexOf(i) >= 0);
        var x = i % n, y = Math.floor(i / n);
        // Klikbare felter (TD Browse' Color Links): uden valg kun hver anden juvel i skakmønster –
        // ethvert byt har netop én juvel af hver farve i mønstret, så alle byt kan stadig startes –
        // og efter et valg kun de 4 naboer (fortryd med Fortryd valg). Resten er inert; musen
        // rammer dem stadig via pladens klik-handler, så mus og berøring virker som før.
        // Med spillets egen dwell slået til (view.alle) er alle felter mål som før.
        var on = view.alle ? true : sel >= 0 ? Math.abs(x - sel % n) + Math.abs(y - Math.floor(sel / n)) === 1 : (x + y) % 2 === 0;
        if (cells[i].inert !== !on) cells[i].inert = !on;
        var st = feltNavn(grid[i], view.fx ? view.fx[i] : 0);
        if (i === sel) st += ', valgt';
        else if (isT) st += ', kan byttes';
        var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + ': ' + st;
        if (cells[i].getAttribute('aria-label') !== label) cells[i].setAttribute('aria-label', label);
      }
    }
    function reflow() { return boardEl.offsetHeight; }
    // Byt: de to juveler glider hen på hinandens plads
    function animSwap(a, b, ms) {
      var ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
      boardEl.style.setProperty('--jv-tid', ms + 'ms');
      jewels[a].classList.add('glid'); jewels[b].classList.add('glid');
      jewels[a].style.setProperty('--dx', bx - ax); jewels[a].style.setProperty('--dy', by - ay);
      jewels[b].style.setProperty('--dx', ax - bx); jewels[b].style.setProperty('--dy', ay - by);
      reflow();
      jewels[a].classList.add('flyt'); jewels[b].classList.add('flyt');
    }
    function clearMotion() {
      jewels.forEach(function (j) {
        j.classList.remove('glid', 'flyt', 'fra-oven', 'lander');
        j.style.removeProperty('--dx'); j.style.removeProperty('--dy'); j.style.removeProperty('--fald');
      });
    }
    // Fald: tegn det nye bræt, og lad juvelerne starte ovenover og glide på plads
    function animFall(step, ms) {
      clearMotion();
      boardEl.style.setProperty('--jv-tid', ms + 'ms');
      var drop = {};
      step.falls.forEach(function (f) { drop[f.to] = Math.floor(f.to / n) - Math.floor(f.from / n); });
      step.spawns.forEach(function (s) { drop[s.to] = s.drop; });
      Object.keys(drop).forEach(function (k) {
        var j = jewels[+k];
        j.style.setProperty('--fald', drop[k]);
        j.classList.add('fra-oven');
      });
      reflow();
      Object.keys(drop).forEach(function (k) { jewels[+k].classList.add('lander'); });
    }
    return {
      build: build, draw: draw, animSwap: animSwap, animFall: animFall, clearMotion: clearMotion,
      cell: function (i) { return cells[i]; },
      get n() { return n; },
      get ready() { return cells.length > 0; }
    };
  }
  function ikon(navn) { return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#jv-ikon-' + navn + '"/></svg>'; }

  global.JuvelerTegn = {
    create: create, installerGrafik: installerGrafik, juvelSvg: juvelSvg, brikHtml: brikHtml, brikNavn: brikNavn, ikon: ikon, cssNum: cssNum,
    typeNavn: typeNavn, typeFlertal: typeFlertal, typeForm: typeForm, feltNavn: feltNavn
  };
})(typeof window !== 'undefined' ? window : globalThis);
