/*
 * Hojt Arkade – tospil.js: to spillere på én skærm.
 *
 * Knappen "To spillere" i rækken med Start spil (og Fortsæt og Dagens udfordring). I tospiller-
 * tilstand skiftes man til at bruge de samme store knapper – fx en øjenstyringsbruger mod en ven
 * eller et familiemedlem. Der gives ingen point på rekordlisten; spillet slutter med en vinder.
 *
 *   ArkadeToSpil.knap({
 *     fortsaet: fortsaet,                        // valgfri: spørg, før et gemt spil slettes
 *     start: function () { startGame({ to: true }); },
 *     tekst: 'på skift'                          // valgfri lille tekst
 *   });
 *   ArkadeToSpil.navn(1)  // 'Spiller 1'
 * Kun ES5, virker fra file://.
 */
(function (global) {
  'use strict';
  var doc = global.document;

  function navn(n) { return 'Spiller ' + n; }

  function knap(o) {
    var startBtn = doc.querySelector(o.startKnap || '#btn-start');
    if (!startBtn) return null;
    var raekke = startBtn.parentNode;
    if (!raekke.classList.contains('arkade-start-raekke')) {
      raekke = doc.createElement('div');
      raekke.className = 'arkade-start-raekke';
      startBtn.parentNode.insertBefore(raekke, startBtn);
      raekke.appendChild(startBtn);
    }
    raekke.classList.add('har-to');
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'btn wide arkade-to-knap';
    b.setAttribute('aria-label', 'To spillere på én skærm' + (o.tekst ? ', ' + o.tekst : ''));
    b.innerHTML = '<span class="big">To spillere</span><span class="small">' + (o.tekst || 'på én skærm') + '</span>';
    raekke.appendChild(b);
    b.addEventListener('click', function () {
      var f = o.fortsaet;
      if (f && f.findes() && global.ArkadeBekraeft) {
        ArkadeBekraeft.spoerg({
          titel: 'Starte et spil for to?',
          tekst: 'Du har et spil i gang. Starter du et spil for to, slettes det.',
          nej: 'Nej, behold det', nejLille: 'vælg Fortsæt bagefter',
          ja: 'Ja, start', jaLille: 'det gemte spil slettes',
          onJa: function () { f.slet(); o.start(); }
        });
        return;
      }
      o.start();
    });
    return b;
  }

  global.ArkadeToSpil = { knap: knap, navn: navn };
})(window);
