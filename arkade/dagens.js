/*
 * Hojt Arkade – dagens.js: Dagens udfordring.
 *
 * Én fast bane, plade eller gåde pr. dag – den samme for alle. Frøet laves ud fra datoen (dansk tid)
 * og spillets navn, så alle får præcis samme spil i dag og et nyt i morgen. Indstillingerne er faste
 * (fx Slangen 15 × 15), så resultaterne kan sammenlignes. Man må prøve så mange gange, man vil.
 *
 * Rekorderne gemmes i kategorien "dag-ÅÅÅÅ-MM-DD" – både på maskinen og på verdenslisten
 * (arkade/highscore.js viser "Dagens udfordring · 2. november" over listen).
 *
 *   var dag = ArkadeDagens.knap({
 *     spil: 'slangen',
 *     fortsaet: fortsaet,                       // valgfri: spørg, før et gemt spil slettes
 *     best: function (kat) { return records.best(kat); },
 *     start: function (dato) { startGame({ dag: dato }); }
 *   });
 *   ArkadeDagens.rng('slangen', dato)   // seedet tilfældighed (funktion, der giver [0, 1))
 *   ArkadeDagens.seed('golf', dato)     // heltal til spil, der selv tager et frø
 *   ArkadeDagens.kat(dato)              // 'dag-2026-11-02'
 *   ArkadeDagens.tekst(dato)            // '2. november'
 * Kun ES5, virker fra file://.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var MDR = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

  // Dagens dato i dansk tid (ÅÅÅÅ-MM-DD), så dagen skifter ved midnat i Danmark for alle
  function dato(d) {
    d = d || new Date();
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
      if (o.year && o.month && o.day) return o.year + '-' + o.month + '-' + o.day;
    } catch (e) { /* gammel browser: brug maskinens dato */ }
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function kat(dt) { return 'dag-' + (dt || dato()); }
  function erDag(k) { return /^dag-\d{4}-\d{2}-\d{2}$/.test(String(k)); }
  function tekst(dt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dt || dato());
    return m ? (+m[3]) + '. ' + MDR[+m[2] - 1] : '';
  }
  function kort(dt) { var t = tekst(dt); return t ? t.slice(0, t.indexOf(' ') + 4) + '.' : ''; }   // '2. nov.'
  // FNV-1a (32 bit) af dato og spil → frø; mulberry32 som generator
  function seed(spil, dt) {
    var s = 'hojt-arkade|dag|' + spil + '|' + (dt || dato()), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }
  // Generatorens tilstand kan gemmes (r.hent()) og lægges ind igen (r.saet(v)), så Fortsæt
  // giver præcis de samme tilfældige tal som uden afbrydelse
  function rng(spil, dt) {
    var a = seed(spil, dt) | 0;
    var r = function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.hent = function () { return a; };
    r.saet = function (v) { if (typeof v === 'number') a = v | 0; };
    return r;
  }

  // Knappen "Dagens udfordring" i rækken med Start spil (og Fortsæt, arkade/fortsaet.js)
  function knap(o) {
    var startBtn = doc.querySelector(o.startKnap || '#btn-start');
    if (!startBtn) return { opdater: function () {} };
    var raekke = startBtn.parentNode;
    if (!raekke.classList.contains('arkade-start-raekke')) {
      raekke = doc.createElement('div');
      raekke.className = 'arkade-start-raekke';
      startBtn.parentNode.insertBefore(raekke, startBtn);
      raekke.appendChild(startBtn);
    }
    raekke.classList.add('har-dag');
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'btn wide arkade-dag-knap';
    b.innerHTML = '<span class="big">Dagens udfordring</span><span class="small arkade-dag-info"></span>';
    raekke.insertBefore(b, startBtn.nextSibling);
    var vist = '';
    function opdater() {
      var dt = dato(), best = 0;
      try { best = o.best ? o.best(kat(dt)) || 0 : 0; } catch (e) { best = 0; }
      var t = kort(dt) + (best > 0 ? ' · bedst ' + best : '');
      if (t === vist) return;
      vist = t;
      b.querySelector('.arkade-dag-info').textContent = t;
      b.setAttribute('aria-label', 'Dagens udfordring, ' + tekst(dt) + (best > 0 ? '. Din bedste i dag: ' + best + ' point' : '. Samme spil for alle i dag'));
    }
    b.addEventListener('click', function () {
      var dt = dato();
      var f = o.fortsaet;
      if (f && f.findes() && global.ArkadeBekraeft) {
        ArkadeBekraeft.spoerg({
          titel: 'Starte dagens udfordring?',
          tekst: 'Du har et spil i gang. Starter du dagens udfordring, slettes det.',
          nej: 'Nej, behold det', nejLille: 'vælg Fortsæt bagefter',
          ja: 'Ja, start', jaLille: 'det gemte spil slettes',
          onJa: function () { f.slet(); o.start(dt); }
        });
        return;
      }
      o.start(dt);
    });
    opdater();
    doc.addEventListener('click', function () { setTimeout(opdater, 0); });
    setInterval(opdater, 30000);   // ny dag ved midnat, ny rekord efter et spil
    return { opdater: opdater, knap: b };
  }

  global.ArkadeDagens = { dato: dato, kat: kat, erDag: erDag, tekst: tekst, seed: seed, rng: rng, knap: knap };
})(window);
