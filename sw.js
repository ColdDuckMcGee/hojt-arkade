/*
 * Hojt Arkade – service worker (offline og langsomt net)
 *
 * Mål: spillene virker uden net efter første besøg og starter, selv når nettet er meget langsomt –
 * uden at nogen bliver hængende på en gammel version.
 *
 *  - Netværk først. Er der net, hentes alt friskt fra hjemmesiden, præcis som uden service worker,
 *    så en rettelse når spillerne med det samme. Hvert svar gemmes også i en lokal kopi.
 *  - Kommer siden ikke inden for VENT_MS (ingen net eller meget langsomt net), bruges den lokale kopi.
 *  - Ingen blanding: en side og alle dens filer kommer samme sted fra. Kom siden fra nettet, hentes
 *    dens filer fra nettet (den lokale kopi bruges kun, hvis en fil slet ikke kan hentes). Kom siden
 *    fra den lokale kopi, hentes dens filer også derfra. Så kan en ny side aldrig køre med gamle
 *    scripts eller omvendt.
 *  - Et spil, der ikke er hentet endnu, viser uden net en rolig besked med en stor knap tilbage.
 *  - Kun filer fra arkaden selv. Rekordlisten (et andet domæne) og alt andet end GET røres ikke.
 *
 * Registreres af arkade/offline.js (kun over http/https; fra disken er der ingen service worker).
 * En ny udgave af denne fil tages i brug ved næste besøg. Ændres KOPI, ryddes den gamle kopi.
 */
'use strict';

var KOPI = 'hojt-arkade-v1';
var VENT_MS = 2500;
// Det, hallen skal bruge, hentes med det samme, så forsiden virker uden net efter første besøg.
// Resten (spillene) gemmes, når de bliver spillet.
var KERNE = [
  './', 'index.html', 'games.js', 'hal/hal.js', 'hal/hal.css',
  'arkade/arkade.css', 'arkade/settings.js', 'arkade/highscores.js', 'arkade/highscore.js', 'arkade/highscore.css',
  'arkade/dwell.js', 'arkade/taster.js', 'arkade/bekraeft.js', 'arkade/bekraeft.css', 'arkade/audio.js',
  'arkade/background.js', 'arkade/fejl.js', 'arkade/offline.js', 'arkade/logo.svg', 'arkade/favicon.svg'
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
function medTidsfrist(p, ms) {
  return new Promise(function (ok, fejl) {
    var t = setTimeout(function () { fejl(new Error('tidsfrist')); }, ms);
    p.then(function (v) { clearTimeout(t); ok(v); }, function (x) { clearTimeout(t); fejl(x); });
  });
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
    // En side: netværk først med tidsfrist, ellers den lokale kopi. Husk kilden for sidens filer.
    var net = fetch(req).then(function (res) { return gem(req, res); });
    e.respondWith(medTidsfrist(net, VENT_MS).then(function (res) {
      husk(e.resultingClientId, 'net');
      return res;
    }).catch(function () {
      return fraKopi(req).then(function (hit) {
        if (hit) { husk(e.resultingClientId, 'kopi'); return hit; }
        // Ingen kopi: vent på nettet alligevel (meget langsomt net), ellers en rolig offline-side
        return net.then(function (res) { husk(e.resultingClientId, 'net'); return res; }).catch(offlineSide);
      });
    }));
    return;
  }

  // En fil på en side: samme kilde som siden
  if (kilde.get(e.clientId) === 'kopi') {
    e.respondWith(fraKopi(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return gem(req, res); });
    }));
    return;
  }
  e.respondWith(fetch(req).then(function (res) { return gem(req, res); }).catch(function () {
    return fraKopi(req).then(function (hit) { return hit || Response.error(); });
  }));
});
