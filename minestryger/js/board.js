/*
 * Minestryger – tegner pladen som et gitter af knapper (så dwell, fokus og
 * tastatur virker på hvert felt) og står for eksplosion og "spol tilbage".
 * Ingen blink og ingen hvide lysglimt. Uden animation bruges en rolig fade.
 *
 * Zoom i fjerdedele (som Sudoku): fire store knapper (.qbtn) ligger oven på pladen.
 * Vælges en fjerdedel, bliver dens rækker og kolonner store og de andre smalle; de
 * andre tre fjerdedele er så store knapper, der skifter zoom. Kun de felter i den
 * zoomede fjerdedel, der kan bruges, er klikbare – resten er inert – så TD Browse'
 * Color Links (og andre blikstyrede browsere) kun ser få, store mål ad gangen.
 */
(function (global) {
  'use strict';

  var ICON = function (id, cls) { return '<svg class="' + cls + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var HINTS = '<span class="cell-hint hint-open">' + ICON('ms-open', 'ico') + '</span>' +
              '<span class="cell-hint hint-flag">' + ICON('ms-flag', 'ico') + '</span>';

  function create(el, opts) {
    var onCell = opts.onCell;
    var cols = 0, rows = 0, buttons = [], cursor = 0, busy = false;
    var zoom = -1, qbtns = [], lastState = null, lastMode = 'open';
    var QNAME = ['øverst til venstre', 'øverst til højre', 'nederst til venstre', 'nederst til højre'];
    function mx() { return Math.ceil(cols / 2); }
    function my() { return Math.ceil(rows / 2); }
    function quadOf(i) { var x = i % cols, y = (i - x) / cols; return (y < my() ? 0 : 2) + (x < mx() ? 0 : 1); }

    function build(state) {
      cols = state.cols; rows = state.rows;
      el.innerHTML = '';
      el.style.setProperty('--cols', cols);
      el.style.setProperty('--rows', rows);
      buttons = [];
      for (var y = 0; y < rows; y++) {
        var row = document.createElement('div');
        row.className = 'board-row'; row.setAttribute('role', 'row');
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x;
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'cell';
          b.dataset.i = i;
          b.setAttribute('role', 'gridcell');
          b.tabIndex = -1;
          b.addEventListener('click', (function (idx) { return function () { if (!busy) { cursor = idx; onCell(idx); } }; })(i));
          b.inert = true;
          b.addEventListener('focus', (function (idx) { return function () { setCursor(idx, false); }; })(i));
          row.appendChild(b);
          buttons.push(b);
        }
        el.appendChild(row);
      }
      var wrap = el.parentNode;
      qbtns.forEach(function (q) { if (q.parentNode) q.parentNode.removeChild(q); });
      qbtns = [];
      for (var k = 0; k < 4; k++) {
        var q = document.createElement('button');
        q.type = 'button';
        q.className = 'qbtn';
        q.dataset.q = k;
        q.setAttribute('aria-label', 'Zoom ind på fjerdedelen ' + QNAME[k]);
        q.addEventListener('click', (function (qk) { return function () { if (!busy) setZoom(qk, true); }; })(k));
        wrap.appendChild(q);
        qbtns.push(q);
      }
      zoom = -1;
      cursor = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
      applyZoom();
    }

    // Sporenes bredde (px fra midte til midte) ved zoom: den zoomede fjerdedels spor er
    // store (helst mindst ca. 126 px), de andre smalle. Pladen fylder det samme som før.
    function pitches(n, m, inZoom, cell) {
      var f = Math.min(0.3, Math.max(0.15, (n * cell / 126 - m) / (n - m)));
      var big = n * cell / (m + (n - m) * f), out = [];
      for (var t = 0; t < n; t++) out.push(inZoom(t) ? big : big * f);
      return out;
    }
    function applyZoom() {
      if (!cols) return;
      var wrap = el.parentNode, cs = getComputedStyle(wrap);
      var cell = parseFloat(cs.getPropertyValue('--cell')) || 120, gap = parseFloat(cs.getPropertyValue('--cell-gap')) || 8;
      var zx = zoom % 2, zy = zoom >> 1;
      var pw = zoom < 0 ? null : pitches(cols, mx(), function (t) { return (t < mx() ? 0 : 1) === zx; }, cell);
      var ph = zoom < 0 ? null : pitches(rows, my(), function (t) { return (t < my() ? 0 : 1) === zy; }, cell);
      el.classList.toggle('zoomed', zoom >= 0);
      buttons.forEach(function (b, i) {
        var x = i % cols, y = (i - x) / cols;
        if (!pw) { b.style.width = b.style.height = ''; b.style.removeProperty('--cs'); return; }
        b.style.width = (pw[x] - gap) + 'px';
        b.style.height = (ph[y] - gap) + 'px';
        b.style.setProperty('--cs', Math.min(pw[x], ph[y]) + 'px');
      });
      // Fjerdedels-knapperne dækker deres felter (og halvdelen af mellemrummet)
      for (var k = 0; k < 4; k++) {
        var a = buttons[(k >> 1 ? my() : 0) * cols + (k % 2 ? mx() : 0)];
        var z = buttons[((k >> 1 ? rows : my()) - 1) * cols + (k % 2 ? cols : mx()) - 1];
        var q = qbtns[k], h = gap / 2;
        q.style.left = (a.offsetLeft - h) + 'px'; q.style.top = (a.offsetTop - h) + 'px';
        q.style.width = (z.offsetLeft + z.offsetWidth - a.offsetLeft + gap) + 'px';
        q.style.height = (z.offsetTop + z.offsetHeight - a.offsetTop + gap) + 'px';
        q.classList.toggle('zoom', k === zoom);
        if (q.inert !== (k === zoom)) q.inert = k === zoom;
      }
      if (lastState) update(lastState, lastMode);
    }
    function setZoom(k, focus) {
      if (k !== zoom) { zoom = k; applyZoom(); }
      if (focus && k >= 0) {
        if (quadOf(cursor) !== k || buttons[cursor].inert) {
          var first = -1;
          for (var i = 0; i < buttons.length; i++) if (quadOf(i) === k && !buttons[i].inert) { first = i; break; }
          if (first >= 0) cursor = first;
        }
        if (!buttons[cursor].inert) setCursor(cursor, true);
      }
    }

    function label(c, x, y) {
      var pos = 'Række ' + (y + 1) + ', kolonne ' + (x + 1) + ': ';
      if (c.revealed) return pos + 'mine (afsløret)';
      if (c.open) return pos + (c.n ? c.n + (c.n === 1 ? ' mine rundt om' : ' miner rundt om') : 'tomt');
      if (c.flag) return pos + 'flag';
      return pos + 'lukket felt';
    }

    // mode: 'open' eller 'flag'. Felter, der ikke kan vælges i den aktuelle
    // tilstand, får aria-disabled, så dwell og skærmlæsere springer dem over.
    function update(state, mode) {
      lastState = state; lastMode = mode;
      state.cells.forEach(function (c, i) {
        var b = buttons[i], x = i % cols, y = (i - x) / cols;
        var kind = c.revealed ? 'mine' : c.open ? 'open' : c.flag ? 'flag' : 'closed';
        if (b.dataset.kind !== kind || b.dataset.n !== String(c.n)) {
          b.dataset.kind = kind; b.dataset.n = String(c.n);
          b.className = 'cell is-' + kind + (kind === 'open' && c.n ? ' n' + c.n : '');
          if (kind === 'open') b.innerHTML = c.n ? '<span class="num">' + c.n + '</span>' : '';
          else if (kind === 'flag') b.innerHTML = ICON('ms-flag', 'ico flag-ico') + HINTS;
          else if (kind === 'mine') b.innerHTML = ICON('ms-mine', 'ico mine-ico');
          else b.innerHTML = HINTS;
        }
        var usable = kind === 'closed' || (kind === 'flag' && mode === 'flag');
        if (usable) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
        // Kun brugbare felter i den zoomede fjerdedel er klikbare (se øverst)
        var off = !usable || zoom < 0 || quadOf(i) !== zoom;
        if (b.inert !== off) b.inert = off;
        b.setAttribute('aria-label', label(c, x, y));
      });
    }

    function setCursor(i, focus) {
      if (i < 0 || i >= buttons.length) return;
      if (buttons[cursor]) buttons[cursor].tabIndex = -1;
      cursor = i;
      buttons[i].tabIndex = 0;
      if (focus) buttons[i].focus({ preventScroll: true });
    }
    // Piletasterne springer over felter, der ikke kan bruges; går man ind i en anden
    // fjerdedel, zoomes der dertil.
    function moveCursor(dx, dy) {
      if (zoom < 0) { // oversigt: piletasterne flytter mellem fjerdedels-knapperne
        var q = qbtns.indexOf(document.activeElement); if (q < 0) q = quadOf(cursor);
        var qx = Math.min(1, Math.max(0, q % 2 + dx)), qy = Math.min(1, Math.max(0, (q >> 1) + dy));
        qbtns[qy * 2 + qx].focus({ preventScroll: true });
        return;
      }
      var x = cursor % cols, y = (cursor - x) / cols;
      for (;;) {
        x += dx; y += dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) return;
        var i = y * cols + x;
        if (quadOf(i) !== zoom) { zoom = quadOf(i); applyZoom(); }
        if (!buttons[i].inert) { setCursor(i, true); return; }
      }
    }
    function focusCursor() {
      if (zoom < 0) qbtns[quadOf(cursor)].focus({ preventScroll: true });
      else setZoom(zoom, true);
    }
    function hasFocus() { return buttons.indexOf(document.activeElement) >= 0 || qbtns.indexOf(document.activeElement) >= 0; }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function finished(anims) { return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); })); }

    // Eksplosion: felterne flyver ud fra minen. Returnerer et objekt, der kan
    // spoles tilbage (samme animationer afspillet baglæns) eller blive liggende.
    function explode(index, calm) {
      busy = true;
      var wrap = el.parentNode;
      wrap.classList.add('exploding');
      if (calm || !el.animate) {
        var fade = el.animate ? el.animate([{ opacity: 1 }, { opacity: 0.18 }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' }) : null;
        return {
          done: fade ? finished([fade]) : wait(700),
          rewind: function () {
            var back = fade ? el.animate([{ opacity: 0.18 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' }) : null;
            return (back ? finished([back]) : wait(900)).then(function () {
              if (fade) fade.cancel(); if (back) back.cancel();
              wrap.classList.remove('exploding'); busy = false;
            });
          },
          end: function () { busy = false; }
        };
      }
      var origin = buttons[index].getBoundingClientRect();
      var ox = origin.left + origin.width / 2, oy = origin.top + origin.height / 2;
      var span = Math.min(window.innerWidth, window.innerHeight);
      // Fast "tilfældighed" pr. felt, så samme plade flyver ens hver gang.
      var seed = index * 9301 + 49297;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      var anims = [];
      buttons.forEach(function (b, i) {
        var r = b.getBoundingClientRect();
        var dx = r.left + r.width / 2 - ox, dy = r.top + r.height / 2 - oy;
        var d = Math.sqrt(dx * dx + dy * dy);
        var ux, uy;
        if (d < 1) { ux = 0; uy = -1; } else { ux = dx / d; uy = dy / d; }
        var dist = (span * (0.16 + rnd() * 0.22) + d * 0.45) * (i === index ? 0.15 : 1);
        var rot = (rnd() - 0.5) * 720;
        var delay = Math.min(260, d * 0.35);
        anims.push(b.animate([
          { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: 'translate(' + (ux * dist * 0.55) + 'px,' + (uy * dist * 0.55) + 'px) rotate(' + (rot * 0.6) + 'deg) scale(0.9)', opacity: 0.95, offset: 0.45 },
          { transform: 'translate(' + (ux * dist) + 'px,' + (uy * dist) + 'px) rotate(' + rot + 'deg) scale(0.7)', opacity: 0.6 }
        ], { duration: 1150, delay: delay, easing: 'cubic-bezier(.12,.75,.3,1)', fill: 'both' }));
      });
      // Trykbølge i orange (ingen hvid), som udvider sig og forsvinder roligt.
      var shock = document.createElement('div');
      shock.className = 'shockwave';
      var wr = wrap.getBoundingClientRect();
      shock.style.left = (ox - wr.left) + 'px';
      shock.style.top = (oy - wr.top) + 'px';
      wrap.appendChild(shock);
      anims.push(shock.animate([
        { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.75 },
        { transform: 'translate(-50%,-50%) scale(9)', opacity: 0 }
      ], { duration: 1000, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }));

      return {
        done: finished(anims),
        anims: anims,
        rewind: function () {
          wrap.classList.add('rewinding');
          anims.forEach(function (a) { a.playbackRate = -0.8; a.play(); });
          return finished(anims).then(function () {
            anims.forEach(function (a) { a.cancel(); });
            shock.remove();
            wrap.classList.remove('rewinding', 'exploding');
            busy = false;
          });
        },
        end: function () { busy = false; }
      };
    }

    function reset() {
      var wrap = el.parentNode;
      el.getAnimations && el.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
      wrap.querySelectorAll('.shockwave').forEach(function (s) { s.remove(); });
      wrap.classList.remove('rewinding', 'exploding');
      busy = false;
    }

    return {
      build: build, update: update, moveCursor: moveCursor, focusCursor: focusCursor, hasFocus: hasFocus,
      relayout: applyZoom, setZoom: setZoom, get zoom() { return zoom; },
      explode: explode, reset: reset,
      get busy() { return busy; }, get cursor() { return cursor; }, buttons: function () { return buttons; }
    };
  }

  global.MinestrygerBoard = { create: create };
})(window);
