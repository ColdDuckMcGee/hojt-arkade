/*
 * Hojt Arkade – dwell.js
 * Dwell-motor til øjenstyring: kig på en knap i en indstillelig tid, så
 * aktiveres den. En tydelig fremskridtsring vises over knappen.
 *
 *   const dwell = ArkadeDwell.create({ enabled: false, timeMs: 1200 });
 *   dwell.setEnabled(true); dwell.setTime(1500);
 *
 * Mål: alle <button>, links (a[href]) og elementer med [data-dwell]
 *       (kan ændres med opts.selector).
 *  - Links med target="_blank" åbnes i en ny fane. Blokerer browseren det
 *    (dwell er ikke et rigtigt klik), åbnes linket i samme fane i stedet.
 *  - Deaktiverede knapper, aria-disabled="true", [data-no-dwell] og skjulte
 *    elementer ignoreres.
 *  - [data-dwell-repeat]: knappen aktiveres igen efter endnu en fuld dwell-tid,
 *    hvis blikket bliver på den (bruges til pileknapper). Ellers skal blikket
 *    forlade knappen, før den kan aktiveres igen.
 *  - Touch ignoreres (der virker almindeligt tryk). Almindeligt klik virker altid.
 * Aktivering sker med element.click(), så spillets egne click-handlere bruges.
 */
(function (global) {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var selector = opts.selector || 'button, a[href], [data-dwell]';
    var enabled = !!opts.enabled;
    var timeMs = opts.timeMs || 1200;
    var onActivate = opts.onActivate || null;

    var lastX = null, lastY = null, inside = false;
    var target = null, start = 0, locked = null, raf = 0;

    var ring = document.createElement('div');
    ring.className = 'arkade-dwell-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML =
      '<svg viewBox="0 0 100 100">' +
      '<circle class="arkade-dwell-track" cx="50" cy="50" r="40"/>' +
      '<circle class="arkade-dwell-progress" cx="50" cy="50" r="40" pathLength="100"/>' +
      '</svg>';
    document.body.appendChild(ring);
    var progressEl = ring.querySelector('.arkade-dwell-progress');

    function isUsable(el) {
      if (!el) return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-no-dwell')) return false;
      if (el.closest('[hidden],[inert]')) return false;
      return true;
    }
    function findTarget(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || el === ring) return null;
      var t = el.closest(selector);
      return isUsable(t) ? t : null;
    }
    function showRing(el, p) {
      var r = el.getBoundingClientRect();
      var size = Math.max(56, Math.min(140, Math.min(r.width, r.height) * 0.8));
      ring.style.width = ring.style.height = size + 'px';
      ring.style.left = (r.left + r.width / 2 - size / 2) + 'px';
      ring.style.top = (r.top + r.height / 2 - size / 2) + 'px';
      progressEl.style.strokeDashoffset = String(100 - p * 100);
      ring.style.display = 'block';
    }
    function hideRing() { ring.style.display = 'none'; }
    function clearTarget() {
      if (target) target.classList.remove('arkade-dwelling');
      target = null;
      hideRing();
    }
    function activate(el, now) {
      if (el.hasAttribute('data-dwell-repeat')) {
        start = now;
      } else {
        locked = el;
        clearTarget();
      }
      if (onActivate) { try { onActivate(el); } catch (e) { console.error(e); } }
      if (el.tagName === 'A' && el.target === '_blank' && el.href) {
        var w = null;
        try { w = global.open(el.href, '_blank'); } catch (e) { w = null; }
        if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
        else global.location.href = el.href;
        return;
      }
      el.click();
    }
    function tick(now) {
      raf = 0;
      if (!enabled || !inside || lastX === null) { clearTarget(); return; }
      var t = findTarget(lastX, lastY);
      if (locked && t !== locked) locked = null;
      if (t === locked) t = null;
      if (t !== target) {
        if (target) target.classList.remove('arkade-dwelling');
        target = t;
        start = now;
        if (target) target.classList.add('arkade-dwelling');
      }
      if (target) {
        var p = Math.min(1, (now - start) / timeMs);
        showRing(target, p);
        if (p >= 1) activate(target, now);
      } else {
        hideRing();
      }
      raf = requestAnimationFrame(tick);
    }
    function loop() { if (!raf && enabled) raf = requestAnimationFrame(tick); }

    function onMove(e) {
      if (e.pointerType === 'touch') return;
      lastX = e.clientX; lastY = e.clientY; inside = true;
      loop();
    }
    function onOut(e) { if (!e.relatedTarget) { inside = false; clearTarget(); } }
    function onBlur() { inside = false; clearTarget(); }

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    global.addEventListener('blur', onBlur);

    return {
      setEnabled: function (v) {
        enabled = !!v;
        locked = null;
        if (!enabled) { clearTarget(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
        else loop();
      },
      isEnabled: function () { return enabled; },
      setTime: function (ms) { timeMs = Math.max(200, Number(ms) || 1200); },
      getTime: function () { return timeMs; },
      reset: function () { locked = null; clearTarget(); },
      destroy: function () {
        enabled = false; clearTarget();
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerover', onMove);
        document.removeEventListener('pointerout', onOut);
        global.removeEventListener('blur', onBlur);
        ring.remove();
      }
    };
  }

  global.ArkadeDwell = { create: create };
})(window);
