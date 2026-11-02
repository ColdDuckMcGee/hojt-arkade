/*
 * Hojt Arkade – service worker: altid nyeste udgave, og offline efter første besøg
 *
 * Spillerne skal altid have den nyeste udgave. Derfor:
 *  - Er der net, spørges serveren ALTID først (også selv om browseren har en kopi, som serveren
 *    har sagt må genbruges i 10 minutter). Uændrede filer koster kun et lille "uændret"-svar.
 *    En rettelse når derfor spillerne ved næste sideindlæsning, uanset browserens cache.
 *  - Den lokale kopi bruges KUN, når serveren slet ikke kan nås (ingen net). Langsomt net venter
 *    på serveren, så man aldrig får en gammel udgave, mens der faktisk er net.
 *  - Ingen blanding: kom siden fra den lokale kopi, kommer alle dens filer også derfra, så en side
 *    aldrig kører med filer fra en anden udgave.
 *  - Sider, der står åbne længe, tjekker selv for en ny udgave og genindlæses ved næste sikre
 *    øjeblik (se arkade/offline.js).
 *  - Et spil, der ikke er hentet endnu, viser uden net en rolig besked med en stor knap tilbage.
 *  - Kun filer fra arkaden selv. Rekordlisten (et andet domæne) og alt andet end GET røres ikke.
 *
 * Registreres af arkade/offline.js (kun over http/https; fra disken er der ingen service worker).
 * Browseren henter selv denne fil igen ved hvert besøg; en ny udgave tages i brug med det samme.
 */
'use strict';

var KOPI = 'hojt-arkade-v2';
// Det, hallen skal bruge, hentes med det samme, så forsiden virker uden net efter første besøg.
// Resten (spillene) gemmes, når de bliver spillet.
var KERNE = [
  './', 'index.html', 'games.js', 'hal/hal.js', 'hal/hal.css',
  'arkade/arkade.css', 'arkade/settings.js', 'arkade/highscores.js', 'arkade/highscore.js', 'arkade/highscore.css',
  'arkade/dwell.js', 'arkade/taster.js', 'arkade/bekraeft.js', 'arkade/bekraeft.css', 'arkade/effekter.js', 'arkade/audio.js',
  'arkade/background.js', 'arkade/fejl.js', 'arkade/offline.js', 'arkade/logo.svg', 'arkade/favicon.svg', 'arkade/stil.js', 'arkade/sigte.js', 'arkade/fortsaet.js', 'arkade/dagens.js', 'arkade/tospil.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(KOPI).then(function (c) {
    // Hver fil for sig: mangler én, skal resten stadig gemmes
    return Promise.all(KERNE.map(function (u) { return c.add(new Request(u, { cache: 'no-cache' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (navne) {
    return Promise.all(navne.filter(function (n) { return n.indexOf('hojt-arkade-') === 0 && n !== KOPI; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Hvilken kilde hver åben side (klient) kom fra: 'net' eller 'kopi'. Holdes lille.
var kilde = new Map();
function husk(id, k) {
  if (!id) return;
  kilde.set(id, k);
  if (kilde.size > 40) kilde.delete(kilde.keys().next().value);
}

function gem(req, res) {
  if (res && res.ok && res.type === 'basic') {
    var kopi = res.clone();
    caches.open(KOPI).then(function (c) { return c.put(req, kopi); }).catch(function () {});
  }
  return res;
}
function fraKopi(req) {
  return caches.open(KOPI).then(function (c) { return c.match(req, { ignoreSearch: req.mode === 'navigate' }); });
}
// Svar til siden mærkes "no-cache": ellers må browseren genbruge en fil fra sin egen hukommelse
// i op til 10 minutter (GitHub Pages sender max-age=600) helt uden om service workeren.
// Med "no-cache" skal den spørge først, og spørgsmålet går gennem service workeren til serveren.
function frisk(res) {
  if (!res || res.type !== 'basic' || res.status !== 200) return res;
  var h = new Headers(res.headers);
  h.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Altid spørg serveren (cache: 'no-cache'): browserens egen kopi må kun bruges, hvis serveren
// svarer "uændret". Så kan en side og dens filer aldrig være fra hver sin udgave.
function fraNet(req) {
  if (req.mode === 'navigate') {
    // En side kan ikke laves om til en ny Request; hent adressen med samme indstillinger.
    return fetch(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'follow' }).then(function (res) {
      // Er siden flyttet (fx /slangen -> /slangen/), skal browseren selv gå til den nye adresse
      return res.redirected ? Response.redirect(res.url, 302) : res;
    });
  }
  return fetch(new Request(req, { cache: 'no-cache' }));
}

function offlineSide() {
  var html = '<!doctype html><html lang="da"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Ingen forbindelse · Hojt Arkade</title>' +
    '<style>html,body{margin:0;height:100%;background:#0c0612;color:#f6ecff;font:20px/1.4 "Segoe UI",system-ui,sans-serif}' +
    'main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;box-sizing:border-box;text-align:center}' +
    'h1{margin:0;font-size:2rem;color:#22eaff}p{margin:0;max-width:30em}' +
    'a{display:flex;align-items:center;justify-content:center;min-width:280px;min-height:113px;padding:0 28px;box-sizing:border-box;' +
    'border:4px solid #ff3fd8;border-radius:18px;color:#ffe8fb;font-weight:800;font-size:1.5rem;text-decoration:none}</style></head>' +
    '<body><main><h1>Ingen forbindelse</h1>' +
    '<p>Dette spil er ikke hentet endnu, og der er ingen forbindelse til nettet lige nu. Spil, du har spillet før, virker også uden net.</p>' +
    '<a href="' + self.registration.scope + '">Tilbage til arkaden</a></main></body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // rekordlisten og andre domæner røres ikke

  if (req.mode === 'navigate') {
    // En side: altid serveren først. Kun hvis den slet ikke kan nås, bruges den lokale kopi.
    e.respondWith(fraNet(req).then(function (res) {
      husk(e.resultingClientId, 'net');
      return res.status === 302 ? res : frisk(gem(req, res));
    }).catch(function () {
      return fraKopi(req).then(function (hit) {
        if (hit) { husk(e.resultingClientId, 'kopi'); return frisk(hit); }
        return offlineSide();
      });
    }));
    return;
  }

  // En fil på en side: samme kilde som siden
  if (kilde.get(e.clientId) === 'kopi') {
    e.respondWith(fraKopi(req).then(function (hit) {
      return frisk(hit || null) || fraNet(req).then(function (res) { return frisk(gem(req, res)); });
    }));
    return;
  }
  e.respondWith(fraNet(req).then(function (res) { return frisk(gem(req, res)); }).catch(function () {
    // Nettet forsvandt midt i indlæsningen: hellere kopien end en ødelagt side
    return fraKopi(req).then(function (hit) { return hit ? frisk(hit) : Response.error(); });
  }));
});
