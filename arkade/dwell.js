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
 *    hvis blikket bliver på den (bruges til drejeknapper og evt. pile).
 *  - Touch ignoreres (der virker almindeligt tryk). Almindeligt klik virker altid.
 *
 * Ét blik = én handling (blik-låsen):
 *  - Efter en aktivering kan samme knap først vælges igen, når blikket har været
 *    uden for knappens kant. Det gælder også, hvis knappen imens bliver deaktiveret,
 *    skjult eller udskiftet (fx under computerens tur eller en animation).
 *  - En ANDEN knap, der dukker op lige dér, hvor blikket er (ny skærm, dialog, zoom),
 *    kan først vælges, når blikket har flyttet sig mindst opts.settlePx (48 px) fra
 *    punktet, hvor valget skete – eller har forladt den gamle knap.
 *  - Det samme gælder knappen under blikket, når siden indlæses med dwell slået til
 *    (hvis blikket allerede er der inden for 0,6 s), og når spillet kalder reset()
 *    (skærmskift, dialog, nyt træk).
 *  - reset() rydder ringen og låser knappen under blikket. release() slipper låsen
 *    helt (bruges kun, hvis man med vilje vil kunne vælge igen med det samme).
 *  - Ryster blikket et øjeblik ud over kanten (under opts.graceMs, 250 ms), stopper
 *    ringen og fortsætter, når blikket er tilbage, i stedet for at starte forfra.
 *
 *  - TD Browse (Tobii Dynavox, en Electron-browser) flytter ikke musen efter blikket,
 *    så dwell kan ikke virke dér. Er dwell slået til, og er browseren TD Browse/Electron
 *    (user agent), eller kommer der klik uden en eneste musebevægelse i 10 s efter, at
 *    dwell er slået til, vises én gang pr. session en venlig besked om at bruge
 *    TD Browse' Click Mode (farveprikkerne) i stedet. Se ArkadeDwell.isTdBrowse().
 * Aktivering sker med element.click(), så spillets egne click-handlere bruges.
 */
(function (global) {
  'use strict';

  // ---------- TD Browse / Electron ----------
  var TD_UA = /Electron\/|TD ?Browse|Tobii|Dynavox/i;
  var NOTICE_KEY = 'hojtArkade.tdBrowseNotice';
  // Adressen på Tobii-vejledningen (/tobii/) regnes ud fra, hvor dwell.js ligger (arkade/dwell.js),
  // så linket virker både fra hallen og fra spillene.
  var VEJLEDNING = (function () {
    try {
      var cs = global.document && global.document.currentScript;
      return cs && cs.src ? new URL('../tobii/', cs.src).href : '';
    } catch (e) { return ''; }
  })();
  function isTdBrowse() {
    try { return TD_UA.test(global.navigator.userAgent || ''); } catch (e) { return false; }
  }
  function noticeSeen() { try { return global.sessionStorage.getItem(NOTICE_KEY) === '1'; } catch (e) { return false; } }
  function markNotice() { try { global.sessionStorage.setItem(NOTICE_KEY, '1'); } catch (e) { /* ignore */ } }
  var noticeEl = null;
  function css(el, o) { for (var k in o) el.style[k] = o[k]; }
  function showTdNotice() {
    if (noticeEl || noticeSeen() || !document.body) return;
    markNotice();
    var wrap = document.createElement('div');
    wrap.id = 'arkade-td-besked';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'arkade-td-titel');
    css(wrap, { position: 'fixed', inset: '0', zIndex: '2147483646', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box', background: 'rgba(0,0,0,.72)' });
    var box = document.createElement('div');
    css(box, { maxWidth: '640px', width: '100%', maxHeight: '100%', overflow: 'auto', boxSizing: 'border-box', padding: '22px 24px',
      background: '#10162b', color: '#fff', border: '3px solid #3ee0ff', borderRadius: '18px', textAlign: 'left',
      font: '19px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,.6)' });
    var h = document.createElement('div');
    h.id = 'arkade-td-titel';
    css(h, { fontWeight: '800', fontSize: '24px', marginBottom: '10px' });
    h.textContent = 'Bruger du TD Browse?';
    var p1 = document.createElement('p');
    css(p1, { margin: '0 0 10px' });
    p1.textContent = 'Hojt Arkades egen dwell (kig på en knap for at vælge den) virker ikke i TD Browse, fordi musen ikke følger blikket dér.';
    var p2 = document.createElement('p');
    css(p2, { margin: '0 0 18px' });
    p2.textContent = 'Brug i stedet TD Browse’ Click Mode: kig på en knap, og vælg den farvede prik ved knappen. Du kan slå Hojt-dwell fra under Indstillinger.';
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'OK';
    css(ok, { display: 'block', width: '100%', minHeight: '84px', margin: '0', padding: '0 18px', cursor: 'pointer',
      background: '#3ee0ff', color: '#00141a', border: '0', borderRadius: '14px', font: '800 24px/1 system-ui, -apple-system, "Segoe UI", sans-serif' });
    ok.addEventListener('click', function (e) {
      e.stopPropagation();
      if (noticeEl && noticeEl.parentNode) noticeEl.parentNode.removeChild(noticeEl);
      noticeEl = null;
    });
    box.appendChild(h); box.appendChild(p1); box.appendChild(p2);
    if (VEJLEDNING) {
      // Stort link til vejledningen med 48 px luft til OK, så TD Browse' farveprikker rammer ét ad gangen.
      var p3 = document.createElement('p');
      css(p3, { margin: '0 0 12px' });
      p3.textContent = 'Vil du undgå dobbeltvalg? Med TD Control og Edge eller Chrome vælger du med ét kig.';
      var link = document.createElement('a');
      link.href = VEJLEDNING;
      link.id = 'arkade-td-vejledning';
      link.textContent = 'Se vejledning';
      css(link, { display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: '100%', minHeight: '84px',
        margin: '0 0 48px', padding: '0 18px', color: '#fff', background: 'transparent', border: '3px dashed #3ee0ff', borderRadius: '14px',
        textDecoration: 'underline', font: '800 22px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif' });
      box.appendChild(p3); box.appendChild(link);
    }
    box.appendChild(ok);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    noticeEl = wrap;
    try { ok.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  function create(opts) {
    opts = opts || {};
    var selector = opts.selector || 'button, a[href], [data-dwell]';
    var enabled = !!opts.enabled;
    var timeMs = opts.timeMs || 1200;
    var onActivate = opts.onActivate || null;
    var settlePx = opts.settlePx != null ? opts.settlePx : 48;   // så langt skal blikket flytte sig, før en ny knap kan vælges
    var graceMs = opts.graceMs != null ? opts.graceMs : 250;     // så længe må blikket ryste ud over kanten uden at ringen starter forfra

    var lastX = null, lastY = null, inside = false;
    var target = null, acc = 0, prev = 0, offSince = 0, raf = 0;
    var idleTimer = 0, ringShown = false, IDLE_MS = 80;
    // Blik-låsen: { el, rect, x, y, moved }. el kan ikke vælges, før blikket har været uden for
    // rect; andre knapper kan ikke vælges, før blikket er flyttet settlePx fra (x, y) eller ud af rect.
    var hold = null;
    // Lås knappen under blikket ved første kendte position, når siden indlæses med dwell slået til
    // (fx Start spil lige dér, hvor man valgte Spil i hallen).
    // En øjenstyring flytter markøren næsten konstant, så kommer den første bevægelse senere end
    // LOAD_HOLD_MS, er blikket først kommet ind på knappen bagefter, og så låses der ikke.
    var holdPending = enabled, createdAt = now(), LOAD_HOLD_MS = 600;
    function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

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
    function rawTarget(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || el === ring) return null;
      return el.closest(selector);
    }
    function findTarget(x, y) {
      var t = rawTarget(x, y);
      return isUsable(t) ? t : null;
    }
    function inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
    function rectOf(el) {
      var r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }

    // Lås el (eller knappen under blikket, hvis el mangler). Knapper med gentagelse låses ikke.
    function holdAt(el) {
      if (!enabled) { holdPending = false; hold = null; return; }   // låsen gælder kun, mens dwell er slået til
      if (lastX === null) { hold = null; return; }
      holdPending = false;
      if (el === undefined) el = rawTarget(lastX, lastY);
      if (el && el.hasAttribute('data-dwell-repeat')) { hold = null; return; }  // gentagelse må fortsætte
      if (!el) {
        // Ingen knap under blikket nu, men en knap, der dukker op samme sted, skal vente på et nyt blik
        hold = { el: null, rect: { left: lastX - settlePx, top: lastY - settlePx, right: lastX + settlePx, bottom: lastY + settlePx },
          x: lastX, y: lastY, moved: false };
        return;
      }
      hold = { el: el, rect: rectOf(el), x: lastX, y: lastY, moved: false };
    }
    // Opdatér låsen ud fra blikket. Giver true, hvis t ikke må vælges lige nu.
    function blocked(t) {
      if (!hold) return false;
      var out = !inRect(hold.rect, lastX, lastY);
      if (out) { hold = null; return false; }          // blikket har forladt den gamle knap: låsen er væk
      if (!hold.moved) {
        var dx = lastX - hold.x, dy = lastY - hold.y;
        if (dx * dx + dy * dy >= settlePx * settlePx) hold.moved = true;
      }
      if (!t) return false;
      if (t === hold.el) return true;                  // samme knap: kræver, at blikket forlader den
      return !hold.moved;                              // ny knap samme sted: kræver, at blikket flytter sig
    }

    function showRing(el, p) {
      var r = el.getBoundingClientRect();
      var size = Math.max(56, Math.min(140, Math.min(r.width, r.height) * 0.8));
      ring.style.width = ring.style.height = size + 'px';
      ring.style.left = (r.left + r.width / 2 - size / 2) + 'px';
      ring.style.top = (r.top + r.height / 2 - size / 2) + 'px';
      progressEl.style.strokeDashoffset = String(100 - p * 100);
      if (!ringShown) { ring.style.display = 'block'; ringShown = true; }
    }
    function hideRing() { if (ringShown) { ring.style.display = 'none'; ringShown = false; } }
    function setTarget(t) {
      if (target === t) return;
      if (target) target.classList.remove('arkade-dwelling');
      target = t; acc = 0; offSince = 0;
      if (target) target.classList.add('arkade-dwelling');
    }
    function clearTarget() { setTarget(null); hideRing(); }
    function activate(el) {
      if (el.hasAttribute('data-dwell-repeat')) {
        acc = 0;
      } else {
        clearTarget();
        holdAt(el);
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
      var dt = prev ? Math.min(100, Math.max(0, now - prev)) : 0;
      prev = now;
      if (!enabled || !inside || lastX === null) { clearTarget(); prev = 0; return; }
      if (holdPending) holdAt();
      var t = findTarget(lastX, lastY);
      if (blocked(t)) t = null;
      if (t && t !== target) {
        setTarget(t);
      } else if (!t && target) {
        // Blikket er gledet af: vent lidt, før ringen starter forfra (rystende blik)
        if (!offSince) offSince = now;
        if (now - offSince > graceMs || !isUsable(target) || !document.contains(target)) clearTarget();
      }
      if (target && t === target) {
        offSince = 0;
        acc += dt;
        var p = Math.min(1, acc / timeMs);
        showRing(target, p);
        if (p >= 1) activate(target);
      } else if (!target) {
        hideRing();
      }
      // Fuld fart kun, mens ringen fylder. Uden mål tjekkes der roligt (ca. 12 gange i sekundet),
      // så motoren ikke tvinger browseren til at tegne 60 billeder i sekundet på ældre maskiner.
      if (target) raf = requestAnimationFrame(tick);
      else { prev = 0; idle(); }
    }
    function idle() {
      if (raf || idleTimer || !enabled) return;
      idleTimer = setTimeout(function () { idleTimer = 0; if (!raf && enabled) raf = requestAnimationFrame(tick); }, IDLE_MS);
    }
    // Ved en bevægelse: tjek med det samme, medmindre et roligt tjek allerede er på vej.
    function loop() { if (!raf && !idleTimer && enabled) { prev = 0; raf = requestAnimationFrame(tick); } }

    // Overvågning: klik uden en eneste musebevægelse, efter dwell er slået til, tyder på
    // TD Browse (eller en anden browser, hvor markøren ikke følger blikket).
    var watchTimer = 0, sawMove = false, sawClick = false, sawTouch = false;
    function watchStart() {
      clearTimeout(watchTimer);
      if (isTdBrowse()) { showTdNotice(); return; }
      sawMove = false; sawClick = false;
      watchTimer = setTimeout(function () {
        watchTimer = 0;
        if (enabled && !sawMove && sawClick && !sawTouch) showTdNotice();
      }, opts.tdWatchMs || 10000);
    }
    function onDown(e) { if (e.pointerType === 'touch') sawTouch = true; }
    function onClick() { if (watchTimer) sawClick = true; }

    function onMove(e) {
      if (e.pointerType === 'touch') return;
      sawMove = true;
      if (holdPending && lastX === null && now() - createdAt > LOAD_HOLD_MS) holdPending = false;
      lastX = e.clientX; lastY = e.clientY; inside = true;
      loop();
    }
    function onOut(e) { if (!e.relatedTarget) { inside = false; clearTarget(); } }
    function onBlur() { inside = false; clearTarget(); }

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    global.addEventListener('blur', onBlur);
    document.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    document.addEventListener('click', onClick, true);
    if (enabled) watchStart();

    return {
      setEnabled: function (v) {
        enabled = !!v;
        if (!enabled) { clearTarget(); clearTimeout(watchTimer); watchTimer = 0; clearTimeout(idleTimer); idleTimer = 0; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
        else { loop(); watchStart(); }
      },
      isEnabled: function () { return enabled; },
      setTime: function (ms) { timeMs = Math.max(200, Number(ms) || 1200); },
      getTime: function () { return timeMs; },
      // Rydder ringen og låser knappen under blikket (fx efter skærmskift eller et træk).
      reset: function () { clearTarget(); holdAt(); },
      // Slipper låsen helt, så knappen under blikket kan vælges med det samme.
      release: function () { hold = null; holdPending = false; },
      isHeld: function () { return !!hold; },
      destroy: function () {
        enabled = false; clearTarget(); clearTimeout(watchTimer); clearTimeout(idleTimer);
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerover', onMove);
        document.removeEventListener('pointerout', onOut);
        global.removeEventListener('blur', onBlur);
        ring.remove();
      }
    };
  }

  global.ArkadeDwell = { create: create, isTdBrowse: isTdBrowse, showTdNotice: showTdNotice };
})(window);
