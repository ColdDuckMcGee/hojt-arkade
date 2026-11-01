/*
 * Hojt Arkade – sigte.js: sigt ved at kigge på målet.
 *
 * Kigge-klik (dwell.js) virker på knapper, og et kigge-klik har ingen koordinater. Derfor
 * lægges usynlige knapper oven på spillepladen – én pr. sigtefelt (en sten, en boble, en kugle,
 * et stykke af banen). Kigger man på et felt, sigter spillet derhen. Drejeknapperne bruges så
 * kun til at finjustere bagefter. Der skydes aldrig: Skyd/Slå/Stød skal stadig vælges.
 *
 *   var sigte = ArkadeSigte.create({
 *     host: boardWrapEl,                 // element med position, som brættet fylder
 *     felter: function () { return [{ x, y, w, h, navn }]; },   // CSS-px i forhold til host
 *     sigt: function (felt, e) { … },    // e = klikket (med musens koordinater ved et rigtigt klik)
 *     aktiv: function () { return true; } // fx: spillet er i gang, ingen salve i luften, indstilling til
 *   });
 *   sigte.opdater();                     // efter hver tegning og ved ændret størrelse
 *
 *  - Felterne kræver 1,5 × dwell-tiden ([data-dwell-faktor]), så et kort blik rundt på brættet
 *    ikke flytter sigtet. Ét blik = én handling som alle andre knapper.
 *  - Med musen: et rigtigt klik giver spillet musens præcise punkt (e.clientX/Y).
 *  - Knapperne er skjult for skærmlæsere og Tab (tastatur og kontakt bruger drejeknapperne).
 *  - Når aktiv() er falsk, er laget væk og fanger ingen klik.
 * Kun ES5, virker fra file://.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var FAKTOR = '1.5';

  function create(opts) {
    var host = opts.host;
    var lag = doc.createElement('div');
    lag.className = 'arkade-sigte';
    lag.setAttribute('aria-hidden', 'true');
    host.appendChild(lag);
    var noegle = '', felter = [];

    function byg(liste) {
      lag.textContent = '';
      felter = liste;
      liste.forEach(function (f, i) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'arkade-sigte-felt';
        b.tabIndex = -1;
        b.setAttribute('data-dwell-faktor', FAKTOR);
        b.setAttribute('data-sigte', String(i));
        b.title = f.navn || 'Sigt hertil';
        b.style.left = f.x + 'px'; b.style.top = f.y + 'px';
        b.style.width = f.w + 'px'; b.style.height = f.h + 'px';
        if (f.rund) b.classList.add('rund');
        lag.appendChild(b);
      });
    }
    lag.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.arkade-sigte-felt') : null;
      if (!b || !opts.aktiv()) return;
      var f = felter[+b.getAttribute('data-sigte')];
      if (f) opts.sigt(f, e);
    });

    function opdater() {
      var paa = !!opts.aktiv();
      lag.hidden = !paa;
      if (!paa) return;
      var liste = opts.felter() || [];
      var k = liste.map(function (f) { return Math.round(f.x) + ',' + Math.round(f.y) + ',' + Math.round(f.w) + ',' + Math.round(f.h); }).join(';');
      if (k !== noegle) { noegle = k; byg(liste); }   // kun når felterne har flyttet sig (ellers ville kigge-klik starte forfra)
    }
    return { opdater: opdater, lag: lag };
  }

  // Et rigtigt museklik (ikke et kigge-klik eller element.click()) har et punkt på skærmen
  function musPunkt(e) { return e && e.isTrusted && e.detail > 0 && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : null; }

  global.ArkadeSigte = { create: create, musPunkt: musPunkt };
})(window);
