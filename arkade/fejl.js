/*
 * Hojt Arkade – fejl.js
 * Viser uventede JavaScript-fejl på skærmen, så en spiller kan tage et
 * skærmbillede og sende det. Indlæses først i <head>, før alle andre scripts.
 *
 *  - Fanger window 'error' og 'unhandledrejection'.
 *  - Banneret har sin egen stil (inline), så det virker, selv om CSS'en ikke er indlæst.
 *  - Viser højst de 3 seneste fejl (gentagelser tælles), browserens user agent og siden.
 *  - "Luk" er en rigtig <button> på mindst 84 px, så den kan vælges med øjnene
 *    (Hojt-dwell, TD Browse' farveprikker, mus og tryk).
 *  - Fejl fra udvidelser og "ResizeObserver loop" ignoreres.
 *
 *   ArkadeFejl.vis('besked')   // vis en fejl manuelt (bruges også i test)
 */
(function (global) {
  'use strict';
  if (global.ArkadeFejl) return;

  var doc = global.document;
  var list = [], box = null, listEl = null, lukket = false;

  function ignore(msg, src) {
    msg = String(msg || ''); src = String(src || '');
    if (/ResizeObserver loop/i.test(msg)) return true;
    if (/^(chrome|moz|safari|safari-web)-extension:/i.test(src)) return true;
    return false;
  }
  function kort(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function fil(src) { return String(src || '').replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, ''); }

  function css(el, o) { for (var k in o) el.style[k] = o[k]; }
  function byg() {
    box = doc.createElement('div');
    box.id = 'arkade-fejl';
    box.setAttribute('role', 'alert');
    css(box, {
      position: 'fixed', left: '8px', right: '8px', bottom: '8px', zIndex: '2147483647',
      maxHeight: '60vh', overflow: 'auto', boxSizing: 'border-box', padding: '14px 16px',
      display: 'flex', gap: '14px', alignItems: 'flex-start',
      background: '#2a0b12', color: '#fff', border: '3px solid #ff5470', borderRadius: '14px',
      boxShadow: '0 6px 30px rgba(0,0,0,.6)', font: '16px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif',
      textAlign: 'left'
    });
    var tekst = doc.createElement('div');
    css(tekst, { flex: '1 1 auto', minWidth: '0' });
    var h = doc.createElement('div');
    css(h, { fontWeight: '800', fontSize: '19px', marginBottom: '4px' });
    h.textContent = 'Ups – der skete en fejl i spillet';
    var p = doc.createElement('div');
    p.textContent = 'Tag gerne et skærmbillede af denne besked, og send det til Hojt Arkade. Så kan vi rette fejlen.';
    listEl = doc.createElement('div');
    css(listEl, { marginTop: '8px', font: '13px/1.35 ui-monospace, Consolas, monospace', wordBreak: 'break-word' });
    var ua = doc.createElement('div');
    css(ua, { marginTop: '6px', font: '12px/1.3 ui-monospace, Consolas, monospace', opacity: '.8', wordBreak: 'break-word' });
    ua.textContent = 'Side: ' + kort(global.location && global.location.pathname, 80) + ' · Browser: ' + kort(global.navigator && global.navigator.userAgent, 260);
    tekst.appendChild(h); tekst.appendChild(p); tekst.appendChild(listEl); tekst.appendChild(ua);
    var luk = doc.createElement('button');
    luk.type = 'button';
    luk.textContent = 'Luk';
    luk.setAttribute('aria-label', 'Luk fejlbeskeden');
    css(luk, {
      flex: 'none', minWidth: '96px', minHeight: '84px', padding: '0 18px', margin: '0', cursor: 'pointer',
      background: '#ff5470', color: '#1a0006', border: '0', borderRadius: '12px',
      font: '800 20px/1 system-ui, -apple-system, "Segoe UI", sans-serif'
    });
    luk.addEventListener('click', function (e) {
      e.stopPropagation();
      lukket = true;
      if (box && box.parentNode) box.parentNode.removeChild(box);
    });
    box.appendChild(tekst); box.appendChild(luk);
  }
  function tegn() {
    if (!doc.body) { doc.addEventListener('DOMContentLoaded', tegn); return; }
    if (!box) byg();
    listEl.innerHTML = '';
    list.forEach(function (f) {
      var d = doc.createElement('div');
      d.textContent = '• ' + f.tekst + (f.n > 1 ? ' (×' + f.n + ')' : '');
      listEl.appendChild(d);
    });
    if (!box.parentNode) doc.body.appendChild(box);
  }
  function vis(tekst) {
    tekst = kort(tekst, 300);
    for (var i = 0; i < list.length; i++) if (list[i].tekst === tekst) { list[i].n++; if (!lukket) tegn(); return; }
    list.push({ tekst: tekst, n: 1 });
    if (list.length > 3) list.shift();
    lukket = false;
    try { tegn(); } catch (e) { /* banneret må aldrig selv give fejl */ }
  }

  global.addEventListener('error', function (e) {
    if (!e || e.target && e.target !== global) return; // fx et billede, der ikke kunne hentes
    if (ignore(e.message, e.filename)) return;
    var sted = e.filename ? ' – ' + fil(e.filename) + (e.lineno ? ':' + e.lineno + (e.colno ? ':' + e.colno : '') : '') : '';
    vis((e.message || 'Ukendt fejl') + sted);
  }, true);
  global.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason, msg = r && (r.message || r.name) ? (r.name ? r.name + ': ' : '') + (r.message || '') : String(r);
    if (ignore(msg, r && r.stack)) return;
    vis('Promise: ' + msg);
  });

  global.ArkadeFejl = { vis: vis };
})(window);
