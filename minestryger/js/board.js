/*
 * Minestryger – tegner pladen som et gitter af knapper (så dwell, fokus og
 * tastatur virker på hvert felt) og står for eksplosion og "spol tilbage".
 * Ingen blink og ingen hvide lysglimt. Uden animation bruges en rolig fade.
 */
(function (global) {
  'use strict';

  var ICON = function (id, cls) { return '<svg class="' + cls + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var HINTS = '<span class="cell-hint hint-open">' + ICON('ms-open', 'ico') + '</span>' +
              '<span class="cell-hint hint-flag">' + ICON('ms-flag', 'ico') + '</span>';

  function create(el, opts) {
    var onCell = opts.onCell;
    var cols = 0, rows = 0, buttons = [], cursor = 0, busy = false;

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
          b.addEventListener('focus', (function (idx) { return function () { setCursor(idx, false); }; })(i));
          row.appendChild(b);
          buttons.push(b);
        }
        el.appendChild(row);
      }
      cursor = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
      setCursor(cursor, false);
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
    function moveCursor(dx, dy) {
      var x = cursor % cols, y = (cursor - x) / cols;
      x = Math.min(cols - 1, Math.max(0, x + dx));
      y = Math.min(rows - 1, Math.max(0, y + dy));
      setCursor(y * cols + x, true);
    }
    function focusCursor() { setCursor(cursor, true); }
    function hasFocus() { return buttons.indexOf(document.activeElement) >= 0; }

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
      explode: explode, reset: reset,
      get busy() { return busy; }, get cursor() { return cursor; }, buttons: function () { return buttons; }
    };
  }

  global.MinestrygerBoard = { create: create };
})(window);
