/*
 * Tårnene – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og
 * tegner brættet i DOM'en som SVG. Kender ingen farver, streger eller glød:
 * udseendet kommer fra klasser og CSS-variabler i det aktive tema, og tårne,
 * fjender og ikoner hentes ved navn fra temaets grafik.js (window.TaarneneTema).
 *
 * Brættet har tre lag:
 *   .lag-under   stien, indgangen og målet (SVG)
 *   .cell        felterne (knapper, man kan bygge på; stien er ikke knapper)
 *   .lag-over    rækkevidde, skud og fjender (SVG, kan ikke klikkes)
 * Klasser på felterne: sti, bygge, har-taarn, valgt, cur (tastaturets markør).
 */
(function (global) {
  'use strict';
  var T = global.TaarneneTema;
  var L = global.TaarneneLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var U = 100;            // én felt-enhed i SVG
  var SCALE = { kugle: 0.56, pil: 0.58, kasse: 0.56, kaempe: 0.8 };

  // Temaets grafik som <symbol>, så HTML og tegnelaget kan bruge <use href="#tt-...">
  function installer(doc) {
    doc = doc || document;
    if (doc.getElementById('tt-grafik')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'tt-grafik';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'tt-grafik');
    var h = '';
    function sym(id, body) { h += '<symbol id="' + id + '" viewBox="0 0 100 100" overflow="visible">' + body + '</symbol>'; }
    Object.keys(T.ikoner).forEach(function (n) { sym('tt-ikon-' + n, T.ikoner[n]); });
    Object.keys(T.taarne).forEach(function (n) { sym('tt-taarn-' + n, T.taarne[n]); });
    Object.keys(T.fjender).forEach(function (n) { sym('tt-fjende-' + n, T.fjender[n]); });
    sym('tt-niveau', T.niveau); sym('tt-indgang', T.indgang); sym('tt-maal', T.maal); sym('tt-felt', T.felt);
    svg.innerHTML = '<defs>' + h + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#tt-ikon-' + navn + '"' + (cls ? ' class="' + cls + '"' : '') + '/></svg>';
  }
  function taarnSvg(type, level, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" class="tt-t tt-t-' + type + (cls ? ' ' + cls : '') + '" overflow="visible">' +
      '<use href="#tt-taarn-' + type + '"/>' + niveauer(level || 0) + '</svg>';
  }
  function fjendeSvg(type) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" class="tt-f tt-f-' + type + '"><use href="#tt-fjende-' + type + '"/></svg>';
  }
  function niveauer(level) {
    var h = '';
    for (var k = 0; k < level; k++) h += '<use href="#tt-niveau" x="' + (66 - k * 16) + '" y="80" width="16" height="16"/>';
    return h;
  }
  function el(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function ang(d) { return Math.atan2(d[1], d[0]) * 180 / Math.PI; }

  function create(boardEl) {
    var map = null, cellEls = [], under, over, rangeG, shotG, enemyG, enemyEls = {}, lastSig = [];
    function build(m) {
      map = m;
      boardEl.innerHTML = '';
      boardEl.style.setProperty('--cols', m.w);
      boardEl.style.setProperty('--rows', m.h);
      var vb = '0 0 ' + m.w * U + ' ' + m.h * U;
      under = el('svg', { 'class': 'lag lag-under', viewBox: vb, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      var pts = [], s = m.path[0], e = m.path[m.path.length - 1], di = L.entryDir(m), de = L.exitDir(m);
      pts.push([(s[0] + 0.5 + di[0] * 0.5) * U, (s[1] + 0.5 + di[1] * 0.5) * U]);
      m.path.forEach(function (c) { pts.push([(c[0] + 0.5) * U, (c[1] + 0.5) * U]); });
      pts.push([(e[0] + 0.5 + de[0] * 0.5) * U, (e[1] + 0.5 + de[1] * 0.5) * U]);
      var d = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
      under.appendChild(el('path', { 'class': 'tt-sti-kant', d: d }));
      under.appendChild(el('path', { 'class': 'tt-sti', d: d }));
      under.appendChild(el('path', { 'class': 'tt-sti-midte', d: d }));
      // Indgang og mål (peger i gåretningen)
      var gi = el('g', { transform: 'translate(' + (s[0] + 0.5) * U + ' ' + (s[1] + 0.5) * U + ') rotate(' + ang([-di[0], -di[1]]) + ')' });
      gi.appendChild(el('use', { href: '#tt-indgang', x: -50, y: -50, width: 100, height: 100, 'class': 'tt-indgang-brug', transform: 'scale(.62)' }));
      under.appendChild(gi);
      var ge = el('g', { transform: 'translate(' + (e[0] + 0.5) * U + ' ' + (e[1] + 0.5) * U + ') rotate(' + ang(de) + ')' });
      ge.appendChild(el('use', { href: '#tt-maal', x: -50, y: -50, width: 100, height: 100, transform: 'scale(.7)' }));
      under.appendChild(ge);
      boardEl.appendChild(under);
      cellEls = [];
      var onPath = {};
      m.path.forEach(function (c, k) { onPath[c[1] * m.w + c[0]] = k; });
      for (var i = 0; i < m.w * m.h; i++) {
        var path = onPath[i] !== undefined;
        var c = document.createElement(path ? 'div' : 'button');
        c.className = 'cell ' + (path ? 'sti' : 'bygge turn-btn');
        if (!path) c.type = 'button';
        c.dataset.i = i;
        c.style.gridColumn = (i % m.w + 1); c.style.gridRow = (Math.floor(i / m.w) + 1);
        if (path) {
          c.setAttribute('role', 'img');
          c.setAttribute('aria-label', 'Stien' + (onPath[i] === 0 ? ', indgang' : onPath[i] === m.path.length - 1 ? ', udgang' : ''));
        }
        c.innerHTML = path ? '' : '<svg class="felt-svg" viewBox="0 0 100 100" aria-hidden="true"><use href="#tt-felt"/></svg><span class="taarn-plads"></span>';
        boardEl.appendChild(c);
        cellEls.push(c);
        lastSig.push('');
      }
      over = el('svg', { 'class': 'lag lag-over', viewBox: vb, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      rangeG = el('g', { 'class': 'tt-raekker' });
      shotG = el('g', { 'class': 'tt-skud-lag' });
      enemyG = el('g', { 'class': 'tt-fjender' });
      over.appendChild(rangeG); over.appendChild(enemyG); over.appendChild(shotG);
      boardEl.appendChild(over);
      enemyEls = {};
    }

    // view: { cursor, selected, names: { laser: 'Laser', … } }
    function cells(game, view) {
      if (!map) return;
      var s = game.state;
      for (var i = 0; i < cellEls.length; i++) {
        var c = cellEls[i], cl = c.classList;
        cl.toggle('cur', i === view.cursor);
        cl.toggle('valgt', i === view.selected);
        if (cl.contains('sti')) continue;
        var t = s.towers[i];
        var sig = t ? t.type + t.level : '';
        if (sig !== lastSig[i]) {
          c.querySelector('.taarn-plads').innerHTML = t ? taarnSvg(t.type, t.level) : '';
          lastSig[i] = sig;
        }
        cl.toggle('har-taarn', !!t);
        var x = i % map.w, y = Math.floor(i / map.w);
        var label = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + ': ' +
          (t ? (view.names[t.type] || t.type) + ', niveau ' + t.level : 'tomt felt, du kan bygge her');
        if (c.getAttribute('aria-label') !== label) c.setAttribute('aria-label', label);
      }
    }
    // Rækkevidden for et tårn (eller et forslag) som en ring
    function range(i, r) {
      rangeG.innerHTML = '';
      if (i === null || i < 0 || !r) return;
      var x = (i % map.w + 0.5) * U, y = (Math.floor(i / map.w) + 0.5) * U;
      rangeG.appendChild(el('circle', { 'class': 'tt-raekkevidde', cx: x, cy: y, r: r * U }));
    }

    // Et billede af bølgen. before: fjenderne før trinnet (id -> {p, hp, type, maxHp}).
    // ev: trinnets hændelser fra logikken. f: 0..1 gennem trinnet. still: rolig visning (intet glider).
    function frame(game, before, ev, f, still) {
      if (!map) return;
      var s = game.state, seen = {};
      var MOVE = 0.55;                   // først går fjenderne, så skyder tårnene
      var mf = still ? 1 : Math.min(1, f / MOVE);
      mf = mf * mf * (3 - 2 * mf);       // blød start og stop
      var shooting = still || f >= MOVE;
      var fade = still ? 0.35 : Math.max(0, 1 - Math.max(0, f - 0.7) / 0.3);
      var moves = {};
      (ev ? ev.moved : []).forEach(function (m) { moves[m.id] = m; });
      function draw(id, type, p, hp, maxHp, alpha, slowed) {
        seen[id] = true;
        var pos = L.posAt(map, p), g = enemyEls[id];
        if (!g) {
          g = el('g', { 'class': 'tt-fjende tt-f-' + type });
          var inner = el('g', { 'class': 'tt-fjende-drej' });
          inner.appendChild(el('use', { href: '#tt-fjende-' + type, x: -50, y: -50, width: 100, height: 100 }));
          g.appendChild(inner);
          g.appendChild(el('rect', { 'class': 'tt-hp-bund', x: -30, y: 34, width: 60, height: 9, rx: 3 }));
          g.appendChild(el('rect', { 'class': 'tt-hp', x: -30, y: 34, width: 60, height: 9, rx: 3 }));
          enemyG.appendChild(g);
          enemyEls[id] = g;
        }
        // Gåretning (til pilen)
        var a = L.posAt(map, p - 0.05), b = L.posAt(map, p + 0.05);
        var sc = SCALE[type] || 0.56;
        g.setAttribute('transform', 'translate(' + (pos.x * U).toFixed(1) + ' ' + (pos.y * U).toFixed(1) + ')');
        g.firstChild.setAttribute('transform', 'rotate(' + ang([b.x - a.x, b.y - a.y]).toFixed(0) + ') scale(' + sc + ')');
        g.style.opacity = alpha;
        g.classList.toggle('saenket', !!slowed);
        var w = Math.max(0, Math.min(1, hp / maxHp));
        g.lastChild.setAttribute('width', (60 * w).toFixed(1));
      }
      // Levende fjender (efter trinnet)
      s.enemies.forEach(function (e) {
        var m = moves[e.id], b0 = before && before[e.id];
        var p = m ? m.from + (m.to - m.from) * mf : e.p;
        var hp = shooting || !b0 ? e.hp : b0.hp;
        draw(e.id, e.type, p, hp, e.maxHp, 1, e.slow > 0);
      });
      // Nedkæmpede i dette trin: de går, bliver ramt og forsvinder roligt
      (ev ? ev.killed : []).forEach(function (k) {
        var m = moves[k.id], b0 = before && before[k.id];
        var p = m ? m.from + (m.to - m.from) * mf : k.p;
        var mx = b0 ? b0.maxHp : 1;
        draw(k.id, k.type, p, shooting ? 0 : (b0 ? b0.hp : 0), mx, shooting ? fade : 1, false);
      });
      // Sluppet ud: går ud over kanten og forsvinder
      (ev ? ev.leaked : []).forEach(function (k) {
        var m = moves[k.id], b0 = before && before[k.id];
        var p = m ? m.from + (m.to - m.from) * mf : k.p;
        draw(k.id, k.type, p, b0 ? b0.hp : 1, b0 ? b0.maxHp : 1, still ? 0.35 : Math.max(0, 1 - mf * 0.8), false);
      });
      Object.keys(enemyEls).forEach(function (id) { if (!seen[id]) { enemyEls[id].remove(); delete enemyEls[id]; } });
      // Skud: rolige streger og ringe, der står stille i resten af trinnet (intet blinker)
      shotG.innerHTML = '';
      if (!ev || !shooting) return;
      var posOf = {};
      s.enemies.forEach(function (e) { posOf[e.id] = L.posAt(map, e.p); });
      ev.killed.forEach(function (k) { posOf[k.id] = L.posAt(map, k.p); });
      ev.shots.forEach(function (sh) {
        var t = s.towers[sh.tower];
        var cx = (sh.tower % map.w + 0.5) * U, cy = (Math.floor(sh.tower / map.w) + 0.5) * U;
        if (sh.type === 'puls' || sh.type === 'frost') {
          var lv = t ? t.level : 1, r = L.towerStats(sh.type, lv).range;
          shotG.appendChild(el('circle', { 'class': 'tt-skud-ring tt-skud-' + sh.type, cx: cx, cy: cy, r: r * U }));
          return;
        }
        sh.targets.forEach(function (id) {
          var p = posOf[id]; if (!p) return;
          shotG.appendChild(el('line', { 'class': 'tt-skud tt-skud-' + sh.type, x1: cx, y1: cy, x2: p.x * U, y2: p.y * U }));
          if (sh.type === 'kanon') shotG.appendChild(el('circle', { 'class': 'tt-nedslag', cx: p.x * U, cy: p.y * U, r: 22 }));
        });
      });
    }
    function clearWave() { shotG.innerHTML = ''; Object.keys(enemyEls).forEach(function (id) { enemyEls[id].remove(); }); enemyEls = {}; }
    return {
      build: build, cells: cells, range: range, frame: frame, clearWave: clearWave,
      get map() { return map; }
    };
  }

  // Et lille stillbillede af en bane (startmenu og game over)
  function miniBane(m, towers) {
    var h = '', vb = '-8 -8 ' + (m.w * U + 16) + ' ' + (m.h * U + 16);
    for (var i = 0; i < m.w * m.h; i++) h += '<use href="#tt-felt" class="mini-felt" x="' + (i % m.w) * U + '" y="' + Math.floor(i / m.w) * U + '" width="100" height="100"/>';
    var d = 'M' + m.path.map(function (c) { return (c[0] + 0.5) * U + ' ' + (c[1] + 0.5) * U; }).join(' L');
    h += '<path class="tt-sti-kant" d="' + d + '"/><path class="tt-sti" d="' + d + '"/>';
    Object.keys(towers || {}).forEach(function (k) {
      var t = towers[k];
      h += '<g class="tt-t tt-t-' + t.type + '"><use href="#tt-taarn-' + t.type + '" x="' + (k % m.w) * U + '" y="' + Math.floor(k / m.w) * U + '" width="100" height="100"/></g>';
    });
    return '<svg class="mini-bane" viewBox="' + vb + '" aria-hidden="true">' + h + '</svg>';
  }

  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  global.TaarneneTegn = { create: create, installer: installer, ikon: ikon, taarnSvg: taarnSvg, fjendeSvg: fjendeSvg, miniBane: miniBane, cssNum: cssNum };
})(typeof window !== 'undefined' ? window : globalThis);
