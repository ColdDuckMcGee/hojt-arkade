/*
 * Rørlægger – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og
 * bygger gitteret i DOM'en som SVG. Kender ingen farver, streger eller glød:
 * udseendet kommer fra klasser og CSS-variabler i det aktive tema, og brikker
 * og ikoner hentes ved navn fra temaets grafik.js (window.RorlaeggerTema).
 *
 * Klasser på felterne (.cell):
 *   fast     kilde eller afløb (kan ikke drejes, er ikke en knap)
 *   forb     forbundet med kilden lige nu (kun når "Vis forbindelse" er slået til)
 *   vaad     vandet løber her (når banen er løst); --d er skridt fra kilden
 *   cur      tastaturets markør
 * På brættet (.board): klaret, tabt.
 */
(function (global) {
  'use strict';
  var T = global.RorlaeggerTema;
  var L = global.RorlaeggerLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NAVN = { lige: 'lige rør', knaek: 'knæk', t: 'T-rør', kryds: 'kryds', kilde: 'kilden', afloeb: 'afløbet' };
  var NAVN2 = { kilde: 'kilde 2 (firkantet)', afloeb: 'afløb 2 (firkantet)' };
  function brik(t) { return t.type + (t.farve ? '2' : ''); }
  function navn(t, two) { return t.farve ? NAVN2[t.type] : two && NAVN[t.type] && (t.type === 'kilde' || t.type === 'afloeb') ? (t.type === 'kilde' ? 'kilde 1 (rund)' : 'afløb 1 (rundt)') : NAVN[t.type]; }
  var RETNING = ['nord', 'øst', 'syd', 'vest'];

  // Temaets ikoner lægges ind som <symbol id="rl-ikon-<navn>">, så HTML kan bruge <use href="#rl-ikon-fortryd">
  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('rl-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'rl-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'rl-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="rl-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    Object.keys(T.brikker).forEach(function (navn) {
      html += '<symbol id="rl-brik-' + navn + '" viewBox="0 0 100 100" overflow="visible">' + T.brikker[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#rl-ikon-' + navn + '"' + (cls ? ' class="' + cls + '"' : '') + '/></svg>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  function aabningerTekst(tile) {
    var o = L.openings(tile), a = [];
    for (var k = 0; k < 4; k++) if (o & L.DIRS[k]) a.push(RETNING[k]);
    return a.length === 4 ? 'alle retninger' : a.join(', ').replace(/, ([^,]*)$/, ' og $1');
  }

  function create(boardEl) {
    var cellEls = [], drejEls = [], angle = [], lastRot = [], builtFor = null, shownWater = null;
    function build(b) {
      var n = b.n;
      boardEl.innerHTML = '';
      boardEl.style.setProperty('--n', n);
      cellEls = []; drejEls = []; angle = []; lastRot = []; shownWater = null;
      for (var i = 0; i < b.tiles.length; i++) {
        var t = b.tiles[i];
        var el = document.createElement(t.fixed ? 'div' : 'button');
        el.className = 'cell' + (t.fixed ? ' fast ' + t.type : ' turn-btn') + (t.farve ? ' b' : '');
        if (!t.fixed) el.type = 'button';
        el.dataset.i = i;
        el.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true" overflow="visible">' + T.felt +
          '<g class="rl-drej" style="transform: rotate(' + (t.rot * 90) + 'deg)"><use href="#rl-brik-' + brik(t) + '"/></g></svg>';
        if (t.fixed) el.setAttribute('role', 'img');
        boardEl.appendChild(el);
        cellEls.push(el); drejEls.push(el.querySelector('.rl-drej'));
        angle.push(t.rot * 90); lastRot.push(t.rot);
      }
      builtFor = b;
    }
    // view: { cursor: markørens felt (-1 = skjult), connected: vis forbindelse til kilden }
    function board(s, view) {
      var b = s.board;
      if (!cellEls.length || builtFor !== b) return;
      var n = b.n, f = s.flow, w = s.water;
      boardEl.classList.toggle('klaret', !!s.solved);
      boardEl.classList.toggle('tabt', !!s.over);
      for (var i = 0; i < cellEls.length; i++) {
        var el = cellEls[i], t = b.tiles[i], cl = el.classList;
        if (t.rot !== lastRot[i]) {
          var d = (t.rot - lastRot[i] + 4) % 4;
          angle[i] += d === 3 ? -90 : d * 90;  // fortryd drejer tilbage
          lastRot[i] = t.rot;
          drejEls[i].style.transform = 'rotate(' + angle[i] + 'deg)';
        }
        var two = b.source2 !== undefined && b.source2 >= 0;
        var d1 = w ? w.dist[i] : -1, d2 = w && w.dist2 ? w.dist2[i] : -1, dist = d1 >= 0 ? d1 : d2;
        cl.toggle('forb', !!view.connected && f && (f.dist[i] >= 0 || (f.dist2 && f.dist2[i] >= 0)));
        cl.toggle('vaad', dist >= 0 || t.type === 'kilde');
        cl.toggle('b', !!t.farve || (d1 < 0 && d2 >= 0));
        if (dist >= 0) el.style.setProperty('--d', dist); else el.style.removeProperty('--d');
        cl.toggle('cur', i === view.cursor);
        var x = i % n, y = Math.floor(i / n);
        var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + ': ' + navn(t, two) + ', åbent mod ' + aabningerTekst(t) +
          (d1 >= 0 ? (two ? ', vand fra kilde 1' : ', vand') : d2 >= 0 ? ', vand fra kilde 2' :
           (view.connected && f && f.dist[i] >= 0 ? (two ? ', forbundet med kilde 1' : ', forbundet') : view.connected && f && f.dist2 && f.dist2[i] >= 0 ? ', forbundet med kilde 2' : ''));
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      }
      shownWater = w;
    }
    return {
      build: build, board: board,
      get builtFor() { return builtFor; },
      get ready() { return cellEls.length > 0; }
    };
  }

  // Lille stillbillede af en bane (bruges på game over): samme brikker, ingen knapper
  function miniBane(b, water) {
    var n = b.w || b.n, rows = b.h || b.n, h = '';
    for (var i = 0; i < b.tiles.length; i++) {
      var t = b.tiles[i], x = (i % n) * 100, y = Math.floor(i / n) * 100;
      var w1 = water && water.dist[i] >= 0, w2 = water && water.dist2 && water.dist2[i] >= 0;
      var wet = w1 || w2 || t.type === 'kilde', b2 = t.farve || (!w1 && w2);
      h += '<g class="mini-cell' + (wet ? ' vaad' : '') + (b2 ? ' b' : '') + '" transform="translate(' + x + ' ' + y + ') rotate(' + (t.rot * 90) + ' 50 50)">' +
        '<use href="#rl-brik-' + brik(t) + '" width="100" height="100"/></g>';
    }
    return '<svg class="mini-bane" viewBox="-6 -6 ' + (n * 100 + 12) + ' ' + (rows * 100 + 12) + '" aria-hidden="true">' + h + '</svg>';
  }

  global.RorlaeggerTegn = { create: create, installerIkoner: installerIkoner, ikon: ikon, cssNum: cssNum, miniBane: miniBane };
})(typeof window !== 'undefined' ? window : globalThis);
