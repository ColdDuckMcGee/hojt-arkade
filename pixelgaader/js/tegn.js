/*
 * Pixelgåder – tegnelaget. Læser kun spillets tilstand (fra game.js) og bygger
 * gitteret i DOM'en. Kender ingen farver: udseendet kommer fra klasser og
 * CSS-variabler i det aktive tema, og ikoner og pixelbilleder hentes ved navn
 * fra temaets grafik.js (window.PixelgaaderTema).
 *
 * Klasser på felterne (.cell): f farvet · x krydset · auto krydset, fordi linjen
 * er løst · err fejl (tomt felt, afsløret) · tip afsløret af et tip · cur
 * tastaturets markør · hl rækken/kolonnen, man kigger på. .mk.sol: felt, der
 * manglede, da spillet blev tabt. Hints (.clue): done og hl.
 */
(function (global) {
  'use strict';
  var T = global.PixelgaaderTema;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Temaets ikoner lægges ind som <symbol id="pg-ikon-<navn>">, så HTML kan bruge <use href="#pg-ikon-udfyld">
  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('pg-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'pg-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'pg-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="pg-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#pg-ikon-' + navn + '"' + (cls ? ' class="' + cls + '"' : '') + '/></svg>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  function billede(sol, n) { return T.pixelbillede(sol, n, cssNum('--pg-pic-rx', 0)); }

  function clueHtml(c) {
    if (!c.length) return '<span>0</span>';
    return c.map(function (v) { return '<span>' + v + '</span>'; }).join('');
  }
  function blockSize(n) { return n >= 10 ? 5 : n === 8 ? 4 : 0; }

  function create(boardEl) {
    var cellEls = [], rowClueEls = [], colClueEls = [], miniEl = null, builtFor = null;
    function build(p) {
      var n = p.n, k = blockSize(n);
      boardEl.innerHTML = '';
      boardEl.style.setProperty('--n', n);
      cellEls = []; rowClueEls = []; colClueEls = [];
      var corner = document.createElement('div');
      corner.className = 'corner';
      corner.innerHTML = '<svg class="mini" viewBox="0 0 ' + n + ' ' + n + '" aria-hidden="true" shape-rendering="crispEdges"></svg>';
      boardEl.appendChild(corner);
      miniEl = corner.firstChild;
      for (var x = 0; x < n; x++) {
        var c = document.createElement('div');
        c.className = 'clue col' + (k && x && x % k === 0 ? ' bl' : '');
        c.innerHTML = clueHtml(p.clues.cols[x]);
        c.setAttribute('aria-label', 'Kolonne ' + (x + 1) + ': ' + (p.clues.cols[x].join(' ') || '0'));
        boardEl.appendChild(c); colClueEls.push(c);
      }
      for (var y = 0; y < n; y++) {
        var r = document.createElement('div');
        r.className = 'clue row' + (k && y && y % k === 0 ? ' bt' : '');
        r.innerHTML = clueHtml(p.clues.rows[y]);
        r.setAttribute('aria-label', 'Række ' + (y + 1) + ': ' + (p.clues.rows[y].join(' ') || '0'));
        boardEl.appendChild(r); rowClueEls.push(r);
        for (var xx = 0; xx < n; xx++) {
          var b = document.createElement('button');
          b.className = 'cell turn-btn' + (k && xx && xx % k === 0 ? ' bl' : '') + (k && y && y % k === 0 ? ' bt' : '');
          b.type = 'button';
          b.dataset.i = y * n + xx;
          b.innerHTML = '<span class="mk"></span>';
          boardEl.appendChild(b); cellEls.push(b);
        }
      }
      builtFor = p;
    }
    // view: { focus: felt, hvis række og kolonne skal markeres (-1 = ingen), cursor: markørens felt (-1 = skjult) }
    function board(s, view) {
      if (!cellEls.length || builtFor !== s.puzzle) return;
      var p = s.puzzle, n = p.n, focus = view.focus, cur = view.cursor;
      var fy = focus >= 0 ? Math.floor(focus / n) : -1, fx = focus >= 0 ? focus % n : -1;
      boardEl.classList.toggle('solved', !!s.solved);
      boardEl.classList.toggle('lost', !!s.over);
      var mini = [];
      for (var i = 0; i < cellEls.length; i++) {
        var el = cellEls[i], m = s.mark[i], lk = s.lock[i], cl = el.classList;
        var x = i % n, y = Math.floor(i / n);
        cl.toggle('f', m === 1);
        cl.toggle('x', m === 2);
        cl.toggle('auto', lk === 'auto');
        cl.toggle('err', lk === 'fejl');
        cl.toggle('tip', lk === 'tip');
        cl.toggle('cur', i === cur);
        cl.toggle('hl', focus >= 0 && (x === fx || y === fy) && i !== focus);
        el.firstChild.classList.toggle('sol', !!s.over && p.sol[i] === 1 && m !== 1);
        if (m === 1) mini.push('<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02"/>');
        var st = m === 1 ? 'farvet' : lk === 'fejl' ? 'tomt (fejl)' : m === 2 ? 'krydset' : 'ikke valgt';
        var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + ', ' + st;
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      }
      if (miniEl) miniEl.innerHTML = mini.join('');
      for (var k = 0; k < n; k++) {
        rowClueEls[k].classList.toggle('done', !!s.rowDone[k]);
        colClueEls[k].classList.toggle('done', !!s.colDone[k]);
        rowClueEls[k].classList.toggle('hl', k === fy);
        colClueEls[k].classList.toggle('hl', k === fx);
      }
    }
    function lives(el, left, max) {
      if (el.dataset.v === String(left)) return;
      var html = '';
      for (var i = 0; i < max; i++) html += ikon('liv', i < left ? 'on' : 'off');
      el.innerHTML = html; el.dataset.v = left;
    }
    return {
      build: build, board: board, lives: lives,
      get builtFor() { return builtFor; },
      get ready() { return cellEls.length > 0; }
    };
  }

  global.PixelgaaderTegn = { create: create, installerIkoner: installerIkoner, ikon: ikon, billede: billede, cssNum: cssNum };
})(typeof window !== 'undefined' ? window : globalThis);
