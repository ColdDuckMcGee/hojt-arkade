/*
 * Hojt Arkade – offline.js
 * Registrerer arkadens service worker (sw.js i roden), så spillene virker uden net efter første
 * besøg og starter, selv når nettet er meget langsomt. Se sw.js for, hvordan den undgår gamle
 * versioner.
 *  - Kun over http/https. Åbnes arkaden fra disken (file://), sker der intet.
 *  - Sw.js ligger i mappen over arkade/, så den dækker hallen og alle spil.
 *  - Fejler registreringen, kører alt som før.
 */
(function (global) {
  'use strict';
  var nav = global.navigator, loc = global.location, doc = global.document;
  if (!nav || !('serviceWorker' in nav) || !loc || !/^https?:$/.test(loc.protocol)) return;
  var src = doc && doc.currentScript && doc.currentScript.src;
  if (!src) return;
  var sw, scope;
  try { sw = new URL('../sw.js', src).href; scope = new URL('../', src).href; } catch (e) { return; }
  function registrer() {
    try { nav.serviceWorker.register(sw, { scope: scope }).catch(function () { /* kører som før */ }); } catch (e) { /* kører som før */ }
  }
  // Efter indlæsning, så registreringen ikke forsinker spillets start
  if (doc.readyState === 'complete') registrer(); else global.addEventListener('load', registrer);
})(window);
