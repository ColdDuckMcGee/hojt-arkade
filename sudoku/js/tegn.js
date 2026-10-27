/*
 * Sudoku – tegnelaget. Læser kun spillets tilstand (fra game.js) og bygger
 * pladen i DOM'en. Kender ingen farver: udseendet kommer fra klasser og
 * CSS-variabler i det aktive tema, og ikoner hentes ved navn fra temaets
 * grafik.js (window.SudokuTema).
 *
 * Pladen er et CSS-gitter med 9 × 9 felter (.cell) og 9 bokse (.boxbtn) ovenpå.
 * Oversigt: boksene er de store knapper. Zoom: den valgte boks' tre rækker og
 * tre kolonner bliver brede (--su-zf), resten smalle, og boksens felter er knapperne.
 *
 * Klasser på felterne: given (tal fra start) · placed (dit tal) · tip (fra et tip)
 * · wrong (forkert tal, overstreget) · sel (valgt felt) · peer (samme række,
 * kolonne eller boks) · same (samme tal) · inzoom / outzoom.
 */
(function (global) {
  'use strict';
  var T = global.SudokuTema, G = global.SudokuGame;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('su-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'su-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'su-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="su-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#su-ikon-' + navn + '"' + (cls ? ' class="' + cls + '"' : '') + '/></svg>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  var BOX_NAMES = ['øverst til venstre', 'øverst i midten', 'øverst til højre', 'i midten til venstre', 'i midten', 'i midten til højre', 'nederst til venstre', 'nederst i midten', 'nederst til højre'];

  function create(boardEl) {
    var cells = [], boxes = [], built = false;
    function build() {
      boardEl.innerHTML = '';
      cells = []; boxes = [];
      for (var i = 0; i < 81; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.i = i;
        b.style.gridRow = String(G.row(i) + 1);
        b.style.gridColumn = String(G.col(i) + 1);
        var nt = '';
        for (var d = 1; d <= 9; d++) nt += '<span data-n="' + d + '"></span>';
        b.innerHTML = '<span class="v"></span><span class="nt" aria-hidden="true">' + nt + '</span>';
        boardEl.appendChild(b); cells.push(b);
      }
      for (var k = 0; k < 9; k++) {
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'boxbtn';
        x.dataset.box = k;
        x.style.gridRow = (Math.floor(k / 3) * 3 + 1) + ' / span 3';
        x.style.gridColumn = ((k % 3) * 3 + 1) + ' / span 3';
        x.setAttribute('aria-label', 'Boks ' + BOX_NAMES[k]);
        boardEl.appendChild(x); boxes.push(x);
      }
      built = true;
    }
    function tracks(zoom) {
      var cols = [], rows = [];
      for (var t = 0; t < 9; t++) {
        cols.push(zoom >= 0 && Math.floor(t / 3) === zoom % 3 ? 'var(--su-zf)' : '1fr');
        rows.push(zoom >= 0 && Math.floor(t / 3) === Math.floor(zoom / 3) ? 'var(--su-zf)' : '1fr');
      }
      boardEl.style.gridTemplateColumns = cols.join(' ');
      boardEl.style.gridTemplateRows = rows.join(' ');
    }
    // view: { zoom: boks (-1 = oversigt), sel: valgt felt (-1 = intet), helpers: fremhæv række/kolonne/boks og ens tal, live }
    function board(run, view) {
      if (!built) build();
      var s = run.state, g = s.grid, given = s.puzzle.givens, zoom = view.zoom, sel = view.sel;
      var selDigit = sel >= 0 ? g[sel] : 0;
      tracks(zoom);
      boardEl.classList.toggle('zoomed', zoom >= 0);
      boardEl.classList.toggle('solved', !!s.solved);
      boardEl.classList.toggle('lost', !!s.over && !s.solved);
      for (var i = 0; i < 81; i++) {
        var el = cells[i], cl = el.classList, v = g[i], bx = G.box(i);
        var inZoom = zoom >= 0 && bx === zoom;
        cl.toggle('given', !!given[i]);
        cl.toggle('placed', !!v && !given[i] && !s.tipped[i]);
        cl.toggle('tip', !!v && !!s.tipped[i]);
        cl.toggle('wrong', !v && !!s.wrong[i]);
        cl.toggle('sel', i === sel);
        cl.toggle('inzoom', inZoom);
        cl.toggle('outzoom', zoom >= 0 && !inZoom);
        var peer = view.helpers && sel >= 0 && i !== sel && (G.row(i) === G.row(sel) || G.col(i) === G.col(sel) || bx === G.box(sel));
        cl.toggle('peer', !!peer);
        cl.toggle('same', !!(view.helpers && selDigit && v === selDigit && i !== sel));
        cl.toggle('notes', !v && !s.wrong[i] && !!s.notes[i]);
        var txt = v ? String(v) : s.wrong[i] ? String(s.wrong[i]) : '';
        if (el.firstChild.textContent !== txt) el.firstChild.textContent = txt;
        var nt = el.lastChild.children, nm = v ? 0 : s.notes[i];
        for (var d = 1; d <= 9; d++) {
          var on = !!(nm & (1 << d));
          var span = nt[d - 1], want = on ? String(d) : '';
          if (span.textContent !== want) span.textContent = want;
          span.classList.toggle('same', on && view.helpers && d === selDigit);
        }
        // Kun felterne i den zoomede boks er mål for dwell og tastaturets Tab
        var target = inZoom && view.live;
        el.tabIndex = target ? 0 : -1;
        if (target) el.removeAttribute('data-no-dwell'); else el.setAttribute('data-no-dwell', '');
        var st = given[i] ? 'givet ' + v : v ? (s.tipped[i] ? 'tip ' : '') + v : s.wrong[i] ? 'tomt, forkert ' + s.wrong[i] : (nm ? 'tomt, noter ' + notesList(nm) : 'tomt');
        var label = 'Række ' + (G.row(i) + 1) + ', kolonne ' + (G.col(i) + 1) + ': ' + st;
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      }
      for (var k = 0; k < 9; k++) {
        var b = boxes[k], active = zoom < 0 && view.live;
        b.classList.toggle('zoom', k === zoom);
        b.classList.toggle('done', run.boxDone(k));
        b.tabIndex = active ? 0 : -1;
        b.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) b.removeAttribute('data-no-dwell'); else b.setAttribute('data-no-dwell', '');
      }
    }
    function notesList(m) { var a = []; for (var d = 1; d <= 9; d++) if (m & (1 << d)) a.push(d); return a.join(' '); }
    function lives(el, left, max) {
      if (el.dataset.v === String(left)) return;
      var html = '';
      for (var i = 0; i < max; i++) html += ikon('liv', i < left ? 'on' : 'off');
      el.innerHTML = html; el.dataset.v = left;
    }
    return { build: build, board: board, lives: lives, get ready() { return built; } };
  }

  global.SudokuTegn = { create: create, installerIkoner: installerIkoner, ikon: ikon, cssNum: cssNum, BOX_NAMES: BOX_NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
