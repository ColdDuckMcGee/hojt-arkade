/* Arkade taster: betjening med kontakter og taster (fx Smartbox Grid 3).
 *
 * - Piletasterne flytter fokus mellem knapperne i menuer, dialoger (fx highscore),
 *   pause- og slutbokse. Er der ingen knap i den retning, går Ned/Højre videre til
 *   næste knap og Op/Venstre tilbage (rundt), så man kan nå alt med én tast.
 *   Under selve spillet (skærmen #game uden åben boks) bruger spillet selv
 *   piletasterne – medmindre skærmen har data-arkade-pilefokus. I hallen skifter
 *   venstre/højre spil som før, mens op/ned flytter fokus.
 * - Enter aktiverer altid den knap, der har synligt fokus (Tab, piletaster), også
 *   i spil hvor Enter ellers er en spilhandling. Mellemrum er uændret.
 * - Har man valgt "Kontakt eller tastatur" på hallens velkomstskærm (gemt i
 *   hojtArkade.styring.indstillinger), sættes data-styring="kontakt" på <html>
 *   (ekstra tydelig fokusring, se arkade.css), og når siden er indlæst, får den
 *   første knap fokus ([data-autofokus], #btn-start, #btn-continue eller første
 *   synlige knap), hvis intet andet har fokus. ArkadeTaster.setStyring/autofokus.
 * Kun ES5, ingen afhængigheder. Registreres i fangstfasen på window, så den kommer
 * før spillenes egne tastaturhandlere.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || !doc.addEventListener || !global.addEventListener) return;
  var DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0] };
  var SEL = 'button, a[href], [role="button"], [role="tab"]';
  var BOX = '.arkade-hs, [role="dialog"], [role="alertdialog"], .overlay';

  function closest(e, sel) {
    for (; e && e.nodeType === 1; e = e.parentNode) if (matches(e, sel)) return e;
    return null;
  }
  function matches(e, sel) {
    var m = e.matches || e.msMatchesSelector || e.webkitMatchesSelector;
    try { return !!(m && m.call(e, sel)); } catch (x) { return false; }
  }
  function shown(e) {
    if (!e || e.hidden || closest(e, '[hidden], [inert], [aria-hidden="true"]')) return false;
    var r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var s = global.getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }
  function filter(list, fn) { var out = []; for (var i = 0; i < list.length; i++) if (fn(list[i])) out.push(list[i]); return out; }
  // Synligt fokus (tastatur). Kender browseren ikke :focus-visible, regnes fokus som synligt.
  function keyFocus(a) {
    var m = a.matches || a.webkitMatchesSelector;
    try { return m.call(a, ':focus-visible'); } catch (x) { return true; }
  }
  // Hvor piletasterne virker: øverste åbne boks, ellers den synlige skærm
  function scope() {
    var boxes = filter(doc.querySelectorAll(BOX), shown);
    if (boxes.length) return boxes[boxes.length - 1];
    var scr = filter(doc.querySelectorAll('.screen'), shown);
    return scr.length ? scr[0] : doc.body;
  }
  function center(e) { var r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  function next(list, a, d) {
    var ca = center(a), best = null, bs = Infinity;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b === a) continue;
      var c = center(b), dx = c[0] - ca[0], dy = c[1] - ca[1];
      var ahead = d[0] ? dx * d[0] : dy * d[1], side = d[0] ? Math.abs(dy) : Math.abs(dx);
      if (ahead <= 1) continue;
      var s = ahead + 2 * side;
      if (s < bs) { bs = s; best = b; }
    }
    if (best) return best;
    var k = list.indexOf(a), step = d[0] + d[1] > 0 ? 1 : -1;
    return list[(k + step + list.length) % list.length];
  }

  // ---------- Valgt styring (fra hallens velkomstskærm) ----------
  var STYRING_KEY = 'hojtArkade.styring.indstillinger';
  function readStyring() {
    try { var raw = global.localStorage.getItem(STYRING_KEY); var v = raw ? JSON.parse(raw) : null; return (v && typeof v.valg === 'string') ? v.valg : ''; }
    catch (x) { return ''; }
  }
  function setStyring(v) {
    var root = doc.documentElement;
    if (v) root.setAttribute('data-styring', v); else root.removeAttribute('data-styring');
  }
  function autofokus(force) {
    if (!force && doc.documentElement.getAttribute('data-styring') !== 'kontakt') return false;
    var a = doc.activeElement;
    if (!force && a && a !== doc.body && a !== doc.documentElement) return false;
    var sc = scope();
    var cands = filter(sc.querySelectorAll('[data-autofokus], #btn-start, #btn-continue'), function (b) { return !b.disabled && shown(b); });
    if (!cands.length) cands = filter(sc.querySelectorAll(SEL), function (b) { return !b.disabled && shown(b); });
    if (!cands.length) return false;
    try { cands[0].focus({ preventScroll: true }); } catch (x) { cands[0].focus(); }
    return true;
  }
  setStyring(readStyring());
  global.addEventListener('load', function () { global.setTimeout(function () { autofokus(false); }, 0); });
  global.ArkadeTaster = { setStyring: setStyring, styring: readStyring, autofokus: autofokus };

  global.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    var a = doc.activeElement, has = a && a !== doc.body && a.nodeType === 1;
    if (e.key === 'Enter') {
      if (has && (a.tagName === 'BUTTON' || (a.tagName === 'A' && a.href)) && keyFocus(a)) {
        e.stopPropagation();                       // browseren klikker selv knappen
        if (e.repeat && !a.hasAttribute('data-dwell-repeat')) e.preventDefault();
      }
      return;
    }
    var d = DIRS[e.key];
    if (!d) return;
    if (has && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    var sc = scope();
    if (sc.id && matches(sc, '.screen') && !sc.hasAttribute('data-arkade-pilefokus')) {
      if (sc.id === 'game') return;
      if (sc.id === 'hal' && d[0]) return;          // hallen: venstre/højre skifter spil, op/ned flytter fokus
    }
    var list = filter(sc.querySelectorAll(SEL), function (b) { return !b.disabled && shown(b); });
    if (!list.length) return;
    e.preventDefault();
    e.stopPropagation();
    var to = has && list.indexOf(a) >= 0 ? next(list, a, d) : list[0];
    if (to && to.focus) to.focus();
  }, true);
})(this);
