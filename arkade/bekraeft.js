/*
 * Hojt Arkade – bekraeft.js
 * En rolig ja/nej-dialog, før man gør noget, der ikke kan fortrydes (fx forlader et spil).
 *
 *   ArkadeBekraeft.spoerg({
 *     titel: 'Vil du forlade spillet?',
 *     tekst: 'Spillet stopper, og pointene gemmes ikke.',
 *     nej: 'Nej, spil videre',            // valgfri
 *     ja: 'Ja, til menuen', jaLille: 'pointene gemmes ikke',
 *     onJa: function () { ... },          // valgfri
 *     onNej: function () { ... }          // valgfri
 *   });
 *   ArkadeBekraeft.aaben();   // true, mens dialogen er åben
 *
 * Til øjenstyring:
 *  - To store knapper med god afstand (mindst 48 px). "Nej" står først og har fokus.
 *  - Knappen, der dukker op lige under blikket (musen), kan ikke vælges, før blikket
 *    har forladt den én gang. Det gælder både Hojt-dwell og klik fra et eget
 *    øjenstyringsprogram (TD Control, Grid 3 …), så valget, der åbnede dialogen,
 *    aldrig også vælger i den.
 *  - Klik ved siden af knapperne gør ingenting. Esc er det samme som Nej.
 *  - Mens dialogen er åben, er resten af siden inert, og tastetryk når ikke spillet
 *    (piletasterne flytter fokus mellem knapperne via taster.js).
 * Stilen ligger i bekraeft.css, som hentes automatisk ved siden af denne fil.
 * Kun ES5, ingen afhængigheder.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.ArkadeBekraeft) return;

  // ---------- Stil ----------
  var me = doc.currentScript && doc.currentScript.src;
  function hentCss() {
    if (doc.getElementById('arkade-bekraeft-css')) return;
    var l = doc.createElement('link');
    l.id = 'arkade-bekraeft-css'; l.rel = 'stylesheet';
    l.href = me ? me.replace(/bekraeft\.js(\?.*)?$/, 'bekraeft.css') : '../arkade/bekraeft.css';
    (doc.head || doc.documentElement).appendChild(l);
  }
  hentCss();

  // ---------- Hvor er blikket? ----------
  var px = null, py = null;
  doc.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY;
    if (vagt) slipVagt();
  }, { passive: true, capture: true });

  var aktiv = null, vagt = null;

  // Knappen under blikket, da dialogen åbnede, er låst, til blikket har forladt den.
  function saetVagt() {
    vagt = null;
    if (px === null || !aktiv) return;
    var el = doc.elementFromPoint(px, py);
    var b = el && el.closest ? el.closest('button') : null;
    if (b && aktiv.ov.contains(b)) {
      var r = b.getBoundingClientRect();
      vagt = { b: b, r: { l: r.left, t: r.top, r: r.right, b: r.bottom } };
      b.setAttribute('data-no-dwell', '');
    }
  }
  function slipVagt() {
    if (!vagt) return;
    var r = vagt.r;
    if (px >= r.l && px <= r.r && py >= r.t && py <= r.b) return;
    vagt.b.removeAttribute('data-no-dwell');
    vagt = null;
  }
  function laast(b) {
    // Klik fra mus eller eget program på den låste knap tæller ikke. Tastaturet (detail 0) tæller.
    return vagt && vagt.b === b;
  }

  function el(tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function knap(cls, ikon, stor, lille) {
    var b = el('button', 'btn arkade-bk-knap ' + cls);
    b.type = 'button';
    var i = el('span', 'icon', ikon); i.setAttribute('aria-hidden', 'true');
    b.appendChild(i);
    b.appendChild(el('span', 'big', stor));
    if (lille) b.appendChild(el('span', 'small', lille));
    return b;
  }

  function luk(svar) {
    var a = aktiv;
    if (!a) return;
    aktiv = null;
    if (vagt) { vagt.b.removeAttribute('data-no-dwell'); vagt = null; }
    a.inert.forEach(function (c) { c.removeAttribute('inert'); });
    if (a.ov.parentNode) a.ov.parentNode.removeChild(a.ov);
    if (svar === 'nej' && a.fokus && a.fokus.focus && doc.contains(a.fokus)) {
      try { a.fokus.focus({ preventScroll: true }); } catch (e) { a.fokus.focus(); }
    }
    var fn = svar === 'ja' ? a.o.onJa : a.o.onNej;
    if (typeof fn === 'function') { try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); } }
  }

  function spoerg(o) {
    o = o || {};
    if (aktiv) luk(null);
    hentCss();
    var ov = el('div', 'arkade-bk');
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'arkade-bk-titel');
    ov.setAttribute('aria-describedby', 'arkade-bk-tekst');
    var kort = el('div', 'arkade-bk-kort panel');
    var h = el('h2', 'arkade-bk-titel neon-sub', o.titel || 'Vil du forlade spillet?'); h.id = 'arkade-bk-titel';
    var p = el('p', 'arkade-bk-tekst muted', o.tekst || 'Spillet stopper, og pointene gemmes ikke.'); p.id = 'arkade-bk-tekst';
    var raekke = el('div', 'arkade-bk-raekke');
    var nej = knap('primary arkade-bk-nej', '▶', o.nej || 'Nej, spil videre', o.nejLille || '');
    var ja = knap('arkade-bk-ja', '■', o.ja || 'Ja, til menuen', o.jaLille != null ? o.jaLille : 'pointene gemmes ikke');
    nej.addEventListener('click', function (e) { e.stopPropagation(); if (e.detail && laast(nej)) return; luk('nej'); });
    ja.addEventListener('click', function (e) { e.stopPropagation(); if (e.detail && laast(ja)) return; luk('ja'); });
    // Klik ved siden af knapperne gør ingenting (og når ikke spillet)
    ov.addEventListener('click', function (e) { e.stopPropagation(); });
    raekke.appendChild(nej); raekke.appendChild(ja);
    kort.appendChild(h); kort.appendChild(p); kort.appendChild(raekke);
    ov.appendChild(kort);

    var a = { ov: ov, o: o, fokus: doc.activeElement, inert: [] };
    var kids = doc.body.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (!c.hasAttribute('inert') && !/arkade-dwell-ring|arkade-fejl/.test(c.className + ' ' + c.id)) { c.setAttribute('inert', ''); a.inert.push(c); }
    }
    doc.body.appendChild(ov);
    aktiv = a;
    saetVagt();
    try { nej.focus({ preventScroll: true }); } catch (e) { nej.focus(); }
    return { luk: function () { luk(null); } };
  }

  // Tastatur: Esc = Nej. Andre taster når ikke spillet, mens dialogen er åben
  // (Enter og mellemrum virker stadig på knappen med fokus, piletasterne via taster.js).
  global.addEventListener('keydown', function (e) {
    if (!aktiv) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); luk('nej'); return; }
    e.stopPropagation();
  }, true);
  global.addEventListener('keyup', function (e) { if (aktiv) e.stopPropagation(); }, true);

  global.ArkadeBekraeft = { spoerg: spoerg, aaben: function () { return !!aktiv; }, luk: function () { luk(null); } };
})(window);
