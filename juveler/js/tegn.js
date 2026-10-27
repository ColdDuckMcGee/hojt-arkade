/*
 * Juveler – tegnelaget. Læser kun spillets tilstand (fra game.js) og bygger
 * brættet i DOM'en. Kender ingen farver: udseendet kommer fra klasser og
 * CSS-variabler i det aktive tema, og juveler og ikoner hentes ved navn fra
 * temaets grafik.js (window.JuvelerTema).
 *
 * Felterne (.cell) er knapper med én juvel (.jv[data-type=<navn>]).
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
  var TYPES = global.JuvelerGame.TYPES;

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
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="jv-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function juvelSvg(type) {
    var navn = TYPES[type];
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#jv-juvel-' + navn + '"/></svg>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  // Danske navne til skærmlæser og beskeder
  var NAVNE = { rubin: 'rubin', safir: 'safir', smaragd: 'smaragd', topas: 'topas', ametyst: 'ametyst', opal: 'opal' };
  var FORMER = { rubin: 'rombe', safir: 'cirkel', smaragd: 'ottekant', topas: 'trekant', ametyst: 'sekskant', opal: 'stjerne' };
  function typeNavn(t) { return NAVNE[TYPES[t]] || ''; }
  function typeForm(t) { return FORMER[TYPES[t]] || ''; }

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
    function setJewel(i, t) {
      if (shown[i] === t) return;
      shown[i] = t;
      var j = jewels[i];
      if (t < 0) { j.innerHTML = ''; j.removeAttribute('data-type'); return; }
      j.dataset.type = TYPES[t];
      j.innerHTML = juvelSvg(t);
    }
    // view: { selected, targets: [], dim: bool, invalid: [a, b] | null, tip: [a, b] | null, cursor, gone: [], busy }
    function draw(grid, view) {
      view = view || {};
      var targets = view.targets || [], gone = view.gone || [], invalid = view.invalid || [], tip = view.tip || [];
      var sel = view.selected === undefined ? -1 : view.selected;
      boardEl.classList.toggle('har-valg', sel >= 0);
      boardEl.classList.toggle('travl', !!view.busy);
      for (var i = 0; i < cells.length; i++) {
        setJewel(i, grid[i]);
        var cl = cells[i].classList, isT = targets.indexOf(i) >= 0;
        cl.toggle('valgt', i === sel);
        cl.toggle('maal', isT);
        cl.toggle('daempet', sel >= 0 && !!view.dim && i !== sel && !isT);
        cl.toggle('ugyldig', invalid.indexOf(i) >= 0);
        cl.toggle('tip', tip.indexOf(i) >= 0);
        cl.toggle('cur', i === view.cursor);
        cl.toggle('vaek', gone.indexOf(i) >= 0);
        var x = i % n, y = Math.floor(i / n);
        var st = grid[i] >= 0 ? typeNavn(grid[i]) + ' (' + typeForm(grid[i]) + ')' : 'tomt';
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

  global.JuvelerTegn = { create: create, installerGrafik: installerGrafik, juvelSvg: juvelSvg, ikon: ikon, cssNum: cssNum, typeNavn: typeNavn, typeForm: typeForm };
})(typeof window !== 'undefined' ? window : globalThis);
