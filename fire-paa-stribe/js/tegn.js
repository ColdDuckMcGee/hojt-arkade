/* Fire på stribe – tegnelaget. Kender ingen farver eller grafik: det bygger brættet
 * af temaets navngivne elementer (window.FirePaaStribeTema) og sætter klasser ud fra
 * en "visning" af spillets tilstand. Al grafik ligger i tema/<navn>/. */
(function (global) {
  'use strict';
  var G = global.FirePaaStribeGame;
  function tema() { return global.FirePaaStribeTema; }

  // Udfyld alle <svg data-ikon="navn"> med temaets ikon af samme navn
  function ikoner(root) {
    var t = tema();
    (root || document).querySelectorAll('svg[data-ikon]').forEach(function (svg) {
      var ik = t.ikoner[svg.getAttribute('data-ikon')];
      if (!ik) return;
      svg.setAttribute('viewBox', ik.viewBox);
      svg.innerHTML = ik.indhold;
    });
  }
  function miniBrik(spiller) { return tema().brikker.mini(spiller); }

  function create(boardEl) {
    var colEls = [], slotEls = [];
    function build() {
      boardEl.innerHTML = '';
      colEls = []; slotEls = [];
      for (var c = 0; c < G.COLS; c++) {
        var b = document.createElement('button');
        b.className = 'col turn-btn';
        b.type = 'button';
        b.dataset.c = c;
        var h = '';
        for (var r = 0; r < G.ROWS; r++) h += '<span class="slot" data-r="' + r + '">' + tema().brikker.hul + '</span>';
        b.innerHTML = h + '<span class="col-num" aria-hidden="true">' + (c + 1) + '</span>';
        boardEl.appendChild(b);
        colEls.push(b);
      }
      for (var i = 0; i < G.N; i++) slotEls.push(colEls[i % G.COLS].children[Math.floor(i / G.COLS)]);
    }
    function setAria(el, off) { if ((el.getAttribute('aria-disabled') === 'true') !== off) el.setAttribute('aria-disabled', String(off)); }
    /* v: { board, focus, cur, tipCol, play, ghost, tipIdx, win (sæt af felter), last, ended,
     *      falling (felt eller -1), fallingMs } */
    function render(v) {
      if (!colEls.length) return;
      var b = v.board;
      boardEl.classList.toggle('ended', !!v.ended);
      for (var i = 0; i < slotEls.length; i++) {
        var sl = slotEls[i], p = b[i], cl = sl.classList;
        cl.toggle('p1', p === G.YOU);
        cl.toggle('p2', p === G.CPU);
        cl.toggle('win', !!v.win[i]);
        cl.toggle('last', i === v.last);
        cl.toggle('ghost', i === v.ghost && !p);
        cl.toggle('tipslot', i === v.tipIdx && !p);
        var d = sl.firstChild;
        if (i === v.falling) {
          if (!d.classList.contains('fall')) {
            d.style.setProperty('--rows', String(Math.floor(i / G.COLS) + 1));
            d.style.setProperty('--dur', v.fallingMs + 'ms');
            d.classList.add('fall');
          }
        } else if (d.classList.contains('fall')) d.classList.remove('fall');
      }
      for (var c = 0; c < colEls.length; c++) {
        var el = colEls[c], full = !G.canDrop(b, c), ccl = el.classList;
        ccl.toggle('focus', c === v.focus);
        ccl.toggle('cur', c === v.cur && v.play);
        ccl.toggle('tip', c === v.tipCol && v.play);
        ccl.toggle('full', full);
        setAria(el, !v.play || full);
        var label = 'Kolonne ' + (c + 1) + (full ? ', fuld' : '') + (c === v.tipCol && v.play ? ', tip: vælg denne' : '');
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      }
    }
    return { build: build, render: render, get ready() { return colEls.length > 0; } };
  }
  global.FirePaaStribeTegn = { create: create, ikoner: ikoner, miniBrik: miniBrik };
})(typeof window !== 'undefined' ? window : globalThis);
