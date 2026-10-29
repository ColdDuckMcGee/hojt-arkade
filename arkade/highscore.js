/*
 * Hojt Arkade – highscore.js
 * Global highscore (verdenslisten) + anonym brugsstatistik oven på highscores.js.
 *
 * Indlæses efter highscores.js:
 *   <script src="../arkade/highscores.js"></script>
 *   <script src="../arkade/highscore.js"></script>   (henter selv highscore.css)
 *
 * Spillet skal kun kalde:
 *   ArkadeHighscore.start();   // når et nyt spil (en ny tur) begynder
 *   ArkadeHighscore.slut();    // ved game over (før/efter records.add – rækkefølgen er ligegyldig)
 * Resten sker af sig selv: records.add() fra ArkadeHighscores kalder efterAdd(), som
 * viser 3-bogstavs-indtastning (hvis scoren kommer på verdens- eller den lokale top 10),
 * sender scoren og viser top 10 med fanerne 'Verden' og 'Min maskine'.
 *
 *   ArkadeHighscore.vis(records, kategori)   // vis top 10 uden indtastning
 *   ArkadeHighscore.visSidste()              // vis top 10 for den liste, rekordskærmen sidst viste
 * En knap med attributten data-hs-verden (fx 'Verden' på rekordskærmen) kalder visSidste().
 *
 * Uden net: kun den lokale liste vises, og scoren lægges i kø og sendes senere.
 * Ingen cookies. Statistikken er kun tællinger (spil, start/slut, varighed, skærm, tema).
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var LS = global.localStorage;
  var API = (function () {
    try { var o = LS.getItem('hojtArkade.api'); if (o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o; } catch (e) {}
    return global.HOJT_API || 'https://hojt-arkade-api.hojt.workers.dev';
  })();
  var SPIL = ['slangen', 'flipper', 'muren', 'bobler', 'blokke', 'minestryger', 'juveler', 'rorlaegger',
    'kasser', 'pixelgaader', 'lysud', 'firepaastribe', 'bomberne', 'kaperen', 'kanonen', 'labyrinten',
    'kaelderen', 'taarnene', 'golf', 'billard', 'soeslag', 'froeen', 'loeberen', 'rumhandleren', 'sudoku',
    'kabalen', 'rampen'];
  var BOGSTAVER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
  // Samme liste som i api/worker.js (serveren afviser dem også).
  var GRIMME = ('ASS ARS FUK FUC FCK FUX FAG CUM CUN CNT KKK NIG NGR NGA SEX TIT DIK DIC DIX COK COC JIZ WTF XXX ' +
    'SOB SUX VAG HOE KYK FAP NAZ ANL BCH BJS KUM MOF PUS SHT TWT PIK PIS LRT LOR KUS FIS RØV RØW BØS HOR LUD TIS SÆD SVN').split(' ');
  var K_NAVN = 'hojtArkade.navn', K_KOE = 'hojtArkade.scoreKoe';
  var MIN = 84;
  // Fra disken (file://) er der intet net-kald (browseren afviser dem alligevel).
  var NET = !(global.location && global.location.protocol === 'file:');
  // Automatiske tests (navigator.webdriver) får ikke dialogen, så spillenes egne tests ikke
  // blokeres. Sæt localStorage 'hojtArkade.hsTest' = '1' for at teste dialogen.
  function dialogTilladt() {
    try { if (global.navigator && navigator.webdriver) return LS.getItem('hojtArkade.hsTest') === '1'; } catch (e) {}
    return true;
  }

  function lsGet(k, d) { try { var v = LS.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function spilId() { var id = global.HOJT_SPIL_ID; return SPIL.indexOf(id) >= 0 ? id : null; }
  function gyldigtNavn(n) { return typeof n === 'string' && /^[A-ZÆØÅ]{3}$/.test(n) && GRIMME.indexOf(n) < 0; }
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dato(iso) { return global.ArkadeHighscores ? global.ArkadeHighscores.formatDate(iso) : ''; }

  // ---------- CSS ----------
  (function css() {
    if (!doc || doc.getElementById('arkade-hs-css')) return;
    var me = doc.currentScript && doc.currentScript.src;
    var href = me ? me.replace(/highscore\.js(\?.*)?$/, 'highscore.css') : '../arkade/highscore.css';
    var l = doc.createElement('link'); l.id = 'arkade-hs-css'; l.rel = 'stylesheet'; l.href = href;
    doc.head.appendChild(l);
  })();

  // ---------- Net ----------
  function hent(url, opts, ms) {
    if (!NET || !global.fetch) return Promise.reject(new Error('ingen fetch'));
    var ctl = global.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 4000);
    return fetch(url, Object.assign({ signal: ctl ? ctl.signal : undefined, credentials: 'omit' }, opts || {}))
      .then(function (r) { clearTimeout(t); return r.json().then(function (j) { j._status = r.status; return j; }); },
        function (e) { clearTimeout(t); throw e; });
  }
  function hentTop(spil, kat) {
    return hent(API + '/scores?spil=' + encodeURIComponent(spil) + '&kat=' + encodeURIComponent(kat) + '&n=10', null, 3500)
      .then(function (j) { if (!j.ok) throw new Error(j.fejl); return j.liste; });
  }
  function send(item) {
    // text/plain = "simpel" forespørgsel uden CORS-forhåndstjek
    return hent(API + '/scores', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(item) }, 5000);
  }
  function koe() { return lsGet(K_KOE, []); }
  var sender = false;
  function sendKoe() {
    if (sender || !NET) return; var q = koe(); if (!q.length) return;
    sender = true;
    send(q[0]).then(function (j) {
      sender = false;
      if (j._status === 429) { setTimeout(sendKoe, ((j.igen || 10) + 1) * 1000); return; }
      var rest = koe(); rest.shift(); lsSet(K_KOE, rest);       // ok eller afvist (4xx): fjern fra køen
      if (rest.length) setTimeout(sendKoe, 11000);
    }, function () { sender = false; });
  }
  function event(type, extra) {
    var spil = spilId(); if (!spil || !NET) return;
    var body = JSON.stringify(Object.assign({ spil: spil, type: type }, extra || {}));
    try {
      if (global.navigator && navigator.sendBeacon && navigator.sendBeacon(API + '/event', new Blob([body], { type: 'text/plain' }))) return;
      fetch(API + '/event', { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) {}
  }
  var t0 = null, venter = null;
  function start() {
    if (venter) { clearTimeout(venter); venter = null; }
    t0 = Date.now();
    var th = doc.documentElement.getAttribute('data-theme') || '';
    event('start', { skaerm: Math.round(global.innerWidth) + 'x' + Math.round(global.innerHeight), tema: th });
  }
  function slut() {
    var v = t0 ? Math.round((Date.now() - t0) / 1000) : undefined;
    t0 = null;
    event('slut', v != null ? { varighed: v } : {});
  }

  // ---------- Overlay ----------
  var ov = null, aktiv = null;
  function nyOverlay() {
    var o = el('div', 'arkade-hs'); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.hidden = true; doc.body.appendChild(o); return o;
  }
  function aabn(render) {
    if (!ov) ov = nyOverlay();
    if (!aktiv) {
      aktiv = { fokus: doc.activeElement, inert: [] };
      Array.prototype.forEach.call(doc.body.children, function (c) {
        if (c !== ov && !c.hasAttribute('inert') && !c.classList.contains('arkade-dwell-ring')) { c.setAttribute('inert', ''); aktiv.inert.push(c); }
      });
      doc.addEventListener('keydown', taster, true);
      doc.addEventListener('keyup', stop, true);
      global.addEventListener('resize', tilpas);
    }
    ov.innerHTML = ''; ov.hidden = false;
    aktiv.render = render; render(ov); tilpas();
    var f = ov.querySelector('[data-hs-fokus]') || ov.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
  function luk() {
    if (!aktiv) return;
    var a = aktiv; aktiv = null;
    ov.hidden = true; ov.innerHTML = '';
    a.inert.forEach(function (c) { c.removeAttribute('inert'); });
    doc.removeEventListener('keydown', taster, true);
    doc.removeEventListener('keyup', stop, true);
    global.removeEventListener('resize', tilpas);
    if (a.fokus && a.fokus.focus && doc.contains(a.fokus)) a.fokus.focus({ preventScroll: true });
    if (a.efter) a.efter();
  }
  function stop(e) { e.stopPropagation(); }
  function taster(e) {
    e.stopPropagation();
    if (aktiv && aktiv.tast) aktiv.tast(e);
  }
  function tilpas() { if (aktiv && aktiv.tilpas) aktiv.tilpas(); }
  function knap(txt, cls, fn) {
    var b = el('button', 'arkade-hs-btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(e); });
    return b;
  }
  function lyd(n) { try { if (global.ArkadeHighscore.lyd) global.ArkadeHighscore.lyd(n); } catch (e) {} }

  // ---------- Navneindtastning ----------
  function indtast(info, done) {
    var forslag = lsGet(K_NAVN, '');
    var navn = gyldigtNavn(forslag) ? forslag.split('') : ['A', 'A', 'A'];
    var harForslag = gyldigtNavn(forslag);
    var pos = harForslag ? 3 : 0;               // tastatur: næste plads der skrives på
    if (!harForslag) navn = ['', '', ''];
    aabn(function (o) {
      o.className = 'arkade-hs arkade-hs-navn';
      var kort = el('div', 'arkade-hs-kort');
      var top = el('div', 'arkade-hs-top');
      top.appendChild(el('div', 'arkade-hs-titel', 'NY REKORD!'));
      top.appendChild(el('div', 'arkade-hs-under', fmt(info.score) + ' point · ' + info.tekst));
      kort.appendChild(top);
      var midt = el('div', 'arkade-hs-midt'); kort.appendChild(midt);
      var pladser = el('div', 'arkade-hs-pladser'); midt.appendChild(pladser);
      var handl = el('div', 'arkade-hs-handl'); midt.appendChild(handl);
      var besked = el('div', 'arkade-hs-besked'); besked.setAttribute('aria-live', 'polite'); top.appendChild(besked);
      var tast = el('div', 'arkade-hs-taster'); kort.appendChild(tast);
      o.appendChild(kort);
      var mode = null, okBtn;

      function bogstavIdx(c) { var i = BOGSTAVER.indexOf(c); return i < 0 ? 0 : i; }
      function skift(i, d) {
        if (!navn[i]) navn[i] = d > 0 ? 'A' : 'Å';
        else navn[i] = BOGSTAVER[(bogstavIdx(navn[i]) + d + BOGSTAVER.length) % BOGSTAVER.length];
        lyd('move'); opdater();
      }
      function skriv(c) {
        if (pos >= 3) { pos = 0; navn = ['', '', '']; }
        navn[pos] = c; pos++; lyd('move'); opdater();
      }
      function slet() {
        if (pos > 0) { pos--; navn[pos] = ''; } lyd('click'); opdater();
      }
      function ok() {
        var n = navn.join('');
        if (!gyldigtNavn(n)) {
          besked.textContent = n.length < 3 ? 'Vælg 3 bogstaver.' : 'Det navn kan ikke bruges. Vælg et andet.';
          return;
        }
        lsSet(K_NAVN, n); lyd('record'); done(n);
      }
      function opdater() {
        besked.textContent = '';
        Array.prototype.forEach.call(pladser.querySelectorAll('.arkade-hs-plads'), function (p, i) {
          p.textContent = navn[i] || '_';
          p.classList.toggle('aktiv', mode === 'grid' ? i === Math.min(pos, 2) && pos < 3 : false);
        });
        if (okBtn) okBtn.setAttribute('aria-disabled', navn.join('').length === 3 ? 'false' : 'true');
      }
      function byg(m) {
        mode = m; pladser.innerHTML = ''; tast.innerHTML = ''; handl.innerHTML = '';
        o.setAttribute('data-mode', m);
        if (m === 'cykel' && navn.join('').length < 3) navn = navn.map(function (c) { return c || 'A'; });
        for (var i = 0; i < 3; i++) {
          (function (i) {
            var kol = el('div', 'arkade-hs-kol');
            if (m === 'cykel') { var up = knap('▲', 'pil', function () { skift(i, -1); }); up.setAttribute('aria-label', 'Forrige bogstav på plads ' + (i + 1)); up.setAttribute('data-dwell-repeat', ''); kol.appendChild(up); }
            var p = el('div', 'arkade-hs-plads'); kol.appendChild(p);
            if (m === 'cykel') { var dn = knap('▼', 'pil', function () { skift(i, 1); }); dn.setAttribute('aria-label', 'Næste bogstav på plads ' + (i + 1)); dn.setAttribute('data-dwell-repeat', ''); kol.appendChild(dn); }
            pladser.appendChild(kol);
          })(i);
        }
        if (m === 'grid') {
          BOGSTAVER.forEach(function (c) { tast.appendChild(knap(c, 'bogstav', function () { skriv(c); })); });
          tast.appendChild(knap('Slet', 'slet', slet));
        }
        okBtn = knap('OK', 'ok', ok); okBtn.setAttribute('data-hs-fokus', '');
        handl.appendChild(okBtn);
        handl.appendChild(knap('Spring over', 'spring', function () { lyd('click'); done(null); }));
        opdater();
      }
      aktiv.tast = function (e) {
        var k = (e.key || '').toUpperCase();
        if (k.length === 1 && BOGSTAVER.indexOf(k) >= 0) { e.preventDefault(); if (mode === 'grid') skriv(k); else { navn[Math.min(pos, 2)] = k; pos = (pos + 1) % 3; opdater(); } }
        else if (e.key === 'Backspace') { e.preventDefault(); slet(); }
        else if (e.key === 'Escape') { e.preventDefault(); done(null); }
        else if (e.key === 'Enter' && doc.activeElement && doc.activeElement.tagName !== 'BUTTON') { e.preventDefault(); ok(); }
      };
      aktiv.tilpas = function () {
        // Gitter med alle bogstaver, hvis knapperne kan blive mindst 84 px; ellers klassisk ▲▼ pr. plads.
        var W = global.innerWidth, H = global.innerHeight;
        var pad = Math.max(10, Math.min(W, H) * 0.02), g = Math.max(6, Math.min(12, Math.min(W, H) * 0.012));
        var slot = Math.floor(Math.max(MIN, Math.min(110, H * 0.12)));
        var head = 72 + slot + 3 * g;                       // titel + pladser/OK-række
        var best = 0, bc = 0;
        for (var c = 5; c <= 15; c++) {
          var r = Math.ceil(30 / c);
          var k = Math.min((W - 2 * pad - (c - 1) * g) / c, (H - 2 * pad - head - (r - 1) * g) / r);
          if (k > best) { best = k; bc = c; }
        }
        var m = best >= MIN ? 'grid' : 'cykel';
        if (m !== mode) byg(m);
        o.style.setProperty('--hs-key', (m === 'grid' ? Math.floor(Math.min(best, 124)) : MIN) + 'px');
        o.style.setProperty('--hs-cols', bc);
        o.style.setProperty('--hs-gap', Math.round(g) + 'px');
        o.style.setProperty('--hs-pad', Math.round(pad) + 'px');
        o.style.setProperty('--hs-slot', (m === 'grid' ? slot : MIN) + 'px');
        o.classList.toggle('lav', H < 560);
      };
    });
  }

  // ---------- Top 10 med faner ----------
  function liste(info) {
    var fane = info.fane || 'verden';
    aabn(function (o) {
      o.className = 'arkade-hs arkade-hs-liste';
      var kort = el('div', 'arkade-hs-kort');
      var side = el('div', 'arkade-hs-side');
      side.appendChild(el('div', 'arkade-hs-titel', 'TOP 10'));
      var faner = el('div', 'arkade-hs-faner'); faner.setAttribute('role', 'tablist');
      var fv = knap('Verden', 'fane', function () { fane = 'verden'; lyd('click'); tegn(); });
      var fm = knap('Min maskine', 'fane', function () { fane = 'lokal'; lyd('click'); tegn(); });
      [fv, fm].forEach(function (b) { b.setAttribute('role', 'tab'); faner.appendChild(b); });
      side.appendChild(faner);
      var videre = knap('Videre', 'ok', function () { lyd('click'); luk(); }); videre.setAttribute('data-hs-fokus', '');
      var boks = el('div', 'arkade-hs-boks');
      var ol = el('ol', 'arkade-hs-rk'); boks.appendChild(ol);
      var note = el('div', 'arkade-hs-note'); boks.appendChild(note);
      kort.appendChild(side); kort.appendChild(boks); kort.appendChild(videre); o.appendChild(kort);

      function tegn() {
        fv.setAttribute('aria-selected', fane === 'verden'); fm.setAttribute('aria-selected', fane === 'lokal');
        fv.setAttribute('aria-pressed', fane === 'verden'); fm.setAttribute('aria-pressed', fane === 'lokal');
        ol.innerHTML = ''; note.textContent = '';
        var rows, nyIdx = -1;
        if (fane === 'lokal') {
          rows = info.records.list(info.kat).map(function (e) { return { navn: e.navn || '---', score: e.score, dato: e.date, id: e.id }; });
          if (info.entryId) nyIdx = rows.findIndex(function (r) { return r.id === info.entryId; });
        } else {
          rows = info.verden;
          if (rows === undefined) { note.textContent = 'Henter verdenslisten …'; }
          else if (rows === null) { note.textContent = 'Verdenslisten kan ikke hentes lige nu.' + (info.iKoe ? ' Din score sendes, når der er net.' : ''); rows = []; }
          if (rows && info.placering && info.placering <= 10) nyIdx = info.placering - 1;
        }
        rows = rows || [];
        for (var i = 0; i < 10; i++) {
          var li = el('li', i === nyIdx ? 'ny' : '');
          li.appendChild(el('span', 'nr', (i + 1) + '.'));
          var r = rows[i];
          li.appendChild(el('span', 'navn', r ? r.navn : '…'));
          li.appendChild(el('span', 'score', r ? fmt(r.score) : ''));
          li.appendChild(el('span', 'dato', r ? dato(r.dato) : ''));
          if (!r) li.classList.add('tom');
          ol.appendChild(li);
        }
        if (fane === 'verden' && info.iKoe && info.verden !== null) note.textContent = 'Din score bliver sendt om lidt.';
        if (fane === 'verden' && info.placering > 10) note.textContent = 'Din score: nr. ' + fmt(info.placering) + ' i verden.';
      }
      info.gentegn = function () { if (aktiv && aktiv.info === info) tegn(); };
      aktiv.info = info;
      aktiv.tast = function (e) { if (e.key === 'Escape' || (e.key === 'Enter' && doc.activeElement && doc.activeElement.tagName !== 'BUTTON')) { e.preventDefault(); luk(); } };
      aktiv.tilpas = function () {
        var W = global.innerWidth, H = global.innerHeight;
        o.classList.toggle('bred', W > H * 1.25 && H < 700);
        var rowsH = (o.classList.contains('bred') ? H - 60 : H - 2 * MIN - 150) / 11.5;
        o.style.setProperty('--hs-row', Math.floor(Math.max(26, Math.min(48, rowsH))) + 'px');
      };
      tegn();
    });
    return info;
  }

  // ---------- Kald fra highscores.js ----------
  function efterAdd(records, kat, score, res) {
    var spil = spilId();
    if (!spil || !doc || doc.visibilityState === 'hidden' || !(score > 0) || !dialogTilladt()) return;
    kat = String(kat);
    var verdenP = hentTop(spil, kat).then(null, function () { return null; });
    var lokalRank = res && res.rank || 0;
    if (venter) clearTimeout(venter);
    venter = setTimeout(function () {
      venter = null;
      verdenP.then(function (verden) {
        var kvalVerden = verden && (verden.length < 10 || score > verden[verden.length - 1].score);
        if (!lokalRank && !kvalVerden) return;
        if (aktiv) return; // allerede en dialog åben
        var tekst = kvalVerden && lokalRank ? 'Top 10 i verden og på maskinen' : kvalVerden ? 'Top 10 i verden' : 'Nr. ' + lokalRank + ' på maskinen';
        indtast({ score: score, tekst: tekst }, function (navn) {
          var info = { records: records, kat: kat, entryId: lokalRank ? res.entry.id : null, verden: verden, fane: kvalVerden ? 'verden' : 'lokal' };
          if (navn && lokalRank) records.setName(kat, res.entry.id, navn);
          if (navn) {
            var item = { spil: spil, kat: kat, navn: navn, score: score };
            send(item).then(function (j) {
              if (j._status === 429) { lsSet(K_KOE, koe().concat([item])); info.iKoe = true; setTimeout(sendKoe, 11000); }
              else if (j.ok) { info.verden = j.liste; info.placering = j.placering; }
              if (info.gentegn) info.gentegn();
            }, function () {
              lsSet(K_KOE, koe().concat([item])); info.iKoe = true; info.verden = null;
              if (info.gentegn) info.gentegn();
            });
          }
          liste(info);
        });
      });
    }, 600);
  }
  function vis(records, kat) {
    var spil = spilId(); if (!spil) return;
    var info = liste({ records: records, kat: String(kat), verden: undefined, fane: 'verden' });
    hentTop(spil, String(kat)).then(function (l) { info.verden = l; }, function () { info.verden = null; })
      .then(function () { if (info.gentegn) info.gentegn(); });
  }

  function visSidste() {
    var s = global.ArkadeHighscores && global.ArkadeHighscores.sidst;
    if (!s || !s.records) return;
    var gk = s.records.globalKat, kat = s.kat;
    if (gk && gk.length && gk.indexOf(kat) < 0) kat = gk[0];   // fx Rampen: verdenslisten er 'biler'
    vis(s.records, kat);
  }
  if (doc) doc.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-hs-verden]');
    if (b && !aktiv) { e.preventDefault(); visSidste(); }
  });

  global.ArkadeHighscore = {
    API: API, start: start, slut: slut, efterAdd: efterAdd, vis: vis, visSidste: visSidste, luk: luk,
    erAaben: function () { return !!aktiv; }, gyldigtNavn: gyldigtNavn, sendKoe: sendKoe, lyd: null
  };
  if (global.addEventListener) global.addEventListener('online', sendKoe);
  setTimeout(sendKoe, 3000);
})(window);
