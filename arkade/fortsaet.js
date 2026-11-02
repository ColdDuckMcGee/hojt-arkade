/*
 * Hojt Arkade – fortsaet.js: fortsæt, hvor du slap.
 *
 * Spillet gemmes af sig selv, mens man spiller (efter hvert klik/tast, hvert 2. sekund og når
 * siden lukkes). Næste gang står der "Fortsæt" ved siden af "Start spil" i menuen. Et spil, der
 * er slut, slettes. Træt, en hjælper der skal afbryde, eller strømmen der går: spillet er der stadig.
 *
 *   var fortsaet = ArkadeFortsaet.create({
 *     spil: 'slangen',                     // nøgle i localStorage: hojtArkade.<spil>.fortsaet
 *     version: 1,                          // skift tallet, hvis det gemte format ændres (gamle gem ignoreres)
 *     gem: function () {                   // det, der skal gemmes (skal kunne JSON'es)
 *       return game && !game.state.over ? { state: game.state } : null;   // null: intet at gemme lige nu
 *     },
 *     info: function (d) { return 'Point ' + d.state.score; },           // lille tekst på Fortsæt-knappen
 *     fortsaet: function (d) { ... genskab spillet og vis det ... }      // false eller en fejl: gemmet slettes
 *   });
 *   fortsaet.slet();     // ved game over (og når spillet er vundet)
 *   fortsaet.gemNu();    // valgfrit: gem med det samme (fx når en animation er færdig)
 *
 *  - gem() kan give null, mens noget er i gang (en kugle i luften): så gemmes der ikke, og det
 *    forrige gem bliver stående, til spillet er i ro igen.
 *  - Knappen "Fortsæt" sættes ind ved #btn-start (opts.start). Når der findes et gemt spil, er
 *    Fortsæt den fremhævede knap, og "Start spil" hedder "Nyt spil" og spørger, før det gemte slettes.
 *  - menu: false: ingen knap; spillet bruger selv hent()/slet() (Kasser har sin egen Fortsæt).
 *  - "Afslut" i pausemenuen beholder spillet (bekraeft.js siger det i sin standardtekst).
 * Kun ES5, virker fra file://.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var aktive = [];

  function ls() { try { return global.localStorage; } catch (e) { return null; } }
  function noegle(spil) { return 'hojtArkade.' + spil + '.fortsaet'; }

  // Findes der et gemt spil (bruges af hallen)
  function findes(spil) {
    var s = ls(); if (!s) return false;
    try { var r = s.getItem(noegle(spil)); return !!(r && JSON.parse(r).data); } catch (e) { return false; }
  }

  function create(o) {
    var KEY = noegle(o.spil), VER = o.version || 1;
    var sidst = null;           // sidst gemte tekst (så der ikke skrives, når intet har ændret sig)
    var startBtn = doc.querySelector(o.start || '#btn-start');
    var knap = null, raekke = null, startStor = null, startTekst = '', startPrimary = false, autoFokus = false;

    function hent() {
      var s = ls(); if (!s) return null;
      try {
        var r = s.getItem(KEY); if (!r) return null;
        var g = JSON.parse(r);
        if (!g || g.v !== VER || !g.data) { s.removeItem(KEY); return null; }
        return g.data;
      } catch (e) { return null; }
    }
    function gemNu() {
      var d;
      try { d = o.gem(); } catch (e) { return; }
      if (!d) return;
      var t;
      try { t = JSON.stringify({ v: VER, tid: Date.now(), data: d }); } catch (e) { return; }
      var sammenlign = t.replace(/"tid":\d+,/, '');
      if (sammenlign === sidst) return;
      var s = ls(); if (!s) return;
      try { s.setItem(KEY, t); sidst = sammenlign; } catch (e) { /* fuldt eller privat tilstand */ }
      opdater();
    }
    function slet() {
      sidst = null;
      var s = ls(); if (s) { try { s.removeItem(KEY); } catch (e) { /* ignore */ } }
      opdater();
    }

    // ---------- Menuknappen ----------
    function byg() {
      if (!startBtn || knap) return;
      raekke = doc.createElement('div');
      raekke.className = 'arkade-start-raekke';
      startBtn.parentNode.insertBefore(raekke, startBtn);
      knap = doc.createElement('button');
      knap.type = 'button';
      knap.className = 'btn primary wide arkade-fortsaet-knap';
      knap.innerHTML = '<span class="big">Fortsæt</span><span class="small arkade-fortsaet-info"></span>';
      raekke.appendChild(knap);
      raekke.appendChild(startBtn);
      startStor = startBtn.querySelector('.big');
      startTekst = startStor ? startStor.textContent : '';
      startPrimary = startBtn.classList.contains('primary');
      autoFokus = startBtn.hasAttribute('data-autofocus');
      knap.addEventListener('click', fortsaet);
      // Nyt spil, mens et gemt findes: spørg først (ét blik må ikke slette et spil)
      startBtn.addEventListener('click', function (e) {
        if (!hent() || !global.ArkadeBekraeft) return;
        e.stopImmediatePropagation(); e.preventDefault();
        var info = infoTekst();
        ArkadeBekraeft.spoerg({
          titel: 'Starte et nyt spil?',
          tekst: 'Du har et spil i gang' + (info ? ' (' + info + ')' : '') + '. Starter du forfra, slettes det.',
          nej: 'Nej, behold det', nejLille: 'vælg Fortsæt bagefter',
          ja: 'Ja, start forfra', jaLille: 'det gemte spil slettes',
          onJa: function () { slet(); startBtn.click(); }
        });
      }, true);
    }
    function infoTekst() {
      var d = hent();
      if (!d || !o.info) return '';
      try { return String(o.info(d) || ''); } catch (e) { return ''; }
    }
    function opdater() {
      if (!knap) return;
      var har = !!hent();
      knap.hidden = !har;
      raekke.classList.toggle('har-gem', har);
      if (startStor) startStor.textContent = har ? 'Nyt spil' : startTekst;
      startBtn.classList.toggle('primary', har ? false : startPrimary);
      if (autoFokus) { knap.toggleAttribute('data-autofocus', har); startBtn.toggleAttribute('data-autofocus', !har); }
      var info = har ? infoTekst() : '';
      knap.querySelector('.arkade-fortsaet-info').textContent = info;
      knap.setAttribute('aria-label', 'Fortsæt spillet' + (info ? ': ' + info : ''));
    }
    function fortsaet() {
      var d = hent();
      if (!d) { opdater(); return; }
      var ok;
      try { ok = o.fortsaet(d); } catch (e) { ok = false; if (global.console) console.error(e); }
      if (ok === false) {
        slet();
        if (global.ArkadeBekraeft) ArkadeBekraeft.spoerg({ titel: 'Spillet kunne ikke hentes', tekst: 'Det gemte spil var ødelagt eller fra en ældre udgave. Start et nyt spil.', nej: 'OK', ja: 'OK', jaLille: '' });
        return;
      }
      if (global.ArkadeHighscore && ArkadeHighscore.start) { try { ArkadeHighscore.start(); } catch (e) { /* ignore */ } }
      sidst = null;
      setTimeout(gemNu, 0);
    }

    // ---------- Gem af sig selv ----------
    function senere() { setTimeout(function () { gemNu(); opdater(); }, 0); }
    doc.addEventListener('click', senere);
    doc.addEventListener('keyup', senere);
    global.addEventListener('pagehide', gemNu);
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') gemNu(); });
    setInterval(function () { if (doc.visibilityState !== 'hidden') gemNu(); }, 2000);

    if (o.menu !== false) byg();   // menu: false – spillet har selv en Fortsæt-knap (fx Kasser)
    opdater();
    // Tastatur og kontakt: med et gemt spil står fokus på Fortsæt i stedet for Nyt spil
    if (knap && startBtn) {
      setTimeout(function () { if (!knap.hidden && doc.activeElement === startBtn) { try { knap.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 0);
    }
    var api = { gemNu: gemNu, slet: slet, hent: hent, findes: function () { return !!hent(); }, opdater: opdater, knap: knap };
    aktive.push(api);
    return api;
  }

  global.ArkadeFortsaet = { create: create, findes: findes, aktiv: function () { return aktive.length > 0; } };
})(window);
