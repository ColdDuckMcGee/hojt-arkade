// Statistik: tæl ikke tests og fravalgte browsere – node arkade/test/statistik.test.js
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.join(__dirname, '..', '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n     ') : e)); }
}

function lager() {
  var d = {};
  return {
    data: d,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; }
  };
}

function loadHighscore(opts) {
  opts = opts || {};
  var sent = [];
  var LS = opts.LS || lager();
  var nav = {
    webdriver: !!opts.webdriver,
    sendBeacon: function (url, body) {
      sent.push({ via: 'beacon', url: url, body: body && body.parts ? body.parts[0] : body });
      return true;
    }
  };
  var loc = { protocol: opts.protocol || 'https:', hostname: opts.hostname || 'arkade.hojt.dk', search: '', pathname: '/slangen/', hash: '' };
  var doc = {
    getElementById: function () { return null; },
    currentScript: null,
    createElement: function () { return { rel: '', href: '', id: '' }; },
    head: { appendChild: function () {} },
    documentElement: { getAttribute: function () { return 'neon'; } },
    addEventListener: function () {},
    visibilityState: 'visible'
  };
  var ctx = {
    window: null,
    document: doc,
    localStorage: LS,
    location: loc,
    navigator: nav,
    console: console,
    Blob: function (parts, o) { this.parts = parts; this.type = o && o.type; },
    fetch: function () { sent.push({ via: 'fetch' }); return { then: function () { return { catch: function () {} }; }, catch: function () {} }; },
    HOJT_SPIL_ID: opts.spil || 'slangen',
    HOJT_API: 'https://hojt-arkade-api.hojt.workers.dev',
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    addEventListener: function () {},
    innerWidth: 1280,
    innerHeight: 800,
    Object: Object,
    JSON: JSON,
    Date: Date,
    Math: Math,
    Array: Array,
    String: String,
    Number: Number,
    Promise: Promise,
    Error: Error
  };
  ctx.window = ctx;
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('arkade/highscore.js'), ctx);
  return { hs: ctx.ArkadeHighscore, sent: sent, LS: LS, ctx: ctx };
}

test('start sender event fra arkade.hojt.dk uden webdriver', function () {
  var r = loadHighscore();
  r.hs.start();
  assert.strictEqual(r.sent.length, 1, 'skulle sende ét event, fik ' + r.sent.length);
  assert.ok(/\/event$/.test(r.sent[0].url));
  var body = JSON.parse(r.sent[0].body);
  assert.strictEqual(body.spil, 'slangen');
  assert.strictEqual(body.type, 'start');
});

test('sendBeacon-fejl falder tilbage til fetch', function () {
  var r = loadHighscore();
  r.ctx.navigator.sendBeacon = function () { return false; };
  r.hs.start();
  assert.strictEqual(r.sent.length, 1);
  assert.strictEqual(r.sent[0].via, 'fetch');
});

test('navigator.webdriver sender intet', function () {
  var r = loadHighscore({ webdriver: true });
  r.hs.start();
  r.hs.slut();
  assert.strictEqual(r.sent.length, 0);
});

test('localhost sender intet (highscore-API er uændret)', function () {
  var r = loadHighscore({ hostname: 'localhost' });
  r.hs.start();
  assert.strictEqual(r.sent.length, 0);
  assert.ok(r.hs.API, 'API-adressen skal stadig findes, så highscores kan sendes');
  assert.ok(/workers\.dev|localhost|127\.0\.0\.1/.test(r.hs.API));
});

test('file:// sender intet (NET er slået fra)', function () {
  var r = loadHighscore({ protocol: 'file:', hostname: '' });
  r.hs.start();
  assert.strictEqual(r.sent.length, 0);
});

test('hojtArkade.ikkeTael = 1 sender intet', function () {
  var LS = lager();
  LS.setItem('hojtArkade.ikkeTael', '1');
  var r = loadHighscore({ LS: LS });
  r.hs.start();
  r.hs.slut();
  assert.strictEqual(r.sent.length, 0);
});

test('ukendt spil-id sender intet', function () {
  var r = loadHighscore({ spil: 'ikke-et-spil' });
  r.hs.start();
  assert.strictEqual(r.sent.length, 0);
});

// ---------- ?ikketael / ?taelmig i settings.js (indlæses i hallen) ----------
function loadSettings(opts) {
  opts = opts || {};
  var LS = opts.LS || lager();
  var replaced = [];
  var appended = [];
  var timers = [];
  var body = { appendChild: function (el) { appended.push(el); } };
  var loc = {
    protocol: 'https:',
    hostname: 'arkade.hojt.dk',
    pathname: opts.pathname || '/',
    search: opts.search || '',
    hash: opts.hash || '',
    href: 'https://arkade.hojt.dk' + (opts.pathname || '/') + (opts.search || '') + (opts.hash || '')
  };
  var doc = {
    documentElement: { setAttribute: function () {}, removeAttribute: function () {} },
    body: opts.noBody ? null : body,
    createElement: function (tag) {
      return { tagName: tag, id: '', style: {}, setAttribute: function (k, v) { this[k] = v; }, textContent: '', parentNode: null };
    },
    addEventListener: function (ev, fn) { doc._on = doc._on || {}; doc._on[ev] = fn; }
  };
  var ctx = {
    window: null,
    document: doc,
    localStorage: LS,
    location: loc,
    history: { replaceState: function (a, b, url) { replaced.push(url); loc.search = (url.match(/\?[^#]*/) || [''])[0]; } },
    console: console,
    setTimeout: function (fn, ms) { timers.push({ fn: fn, ms: ms }); return timers.length; },
    JSON: JSON,
    Object: Object,
    Event: function () {}
  };
  ctx.window = ctx;
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('arkade/settings.js'), ctx);
  if (opts.noBody && doc._on && doc._on.DOMContentLoaded) {
    doc.body = body;
    doc._on.DOMContentLoaded();
  }
  return { LS: LS, replaced: replaced, appended: appended, timers: timers, ctx: ctx, doc: doc };
}

test('hallen indlæser settings.js (ikketael kører uden highscore.js)', function () {
  var html = read('index.html');
  assert.ok(/src="arkade\/settings\.js"/.test(html), 'index.html skal indlæse settings.js');
  assert.ok(!/src="arkade\/highscore\.js"/.test(html), 'hallen indlæser ikke highscore.js – opt-out skal ligge i settings.js');
  var s = read('arkade/settings.js');
  assert.ok(/ikketael/.test(s) && /taelmig/.test(s) && /hojtArkade\.ikkeTael/.test(s));
  assert.ok(/Denne browser tælles ikke med i statistikken\./.test(s));
  assert.ok(/Denne browser tælles med i statistikken igen\./.test(s));
});

test('?ikketael sætter flag, viser bekræftelse og renser URL', function () {
  var r = loadSettings({ search: '?ikketael' });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), '1');
  assert.strictEqual(r.appended.length, 1, 'skal vise én bekræftelse');
  assert.strictEqual(r.appended[0].textContent, 'Denne browser tælles ikke med i statistikken.');
  assert.strictEqual(r.appended[0]['role'] || r.appended[0].role, 'status');
  assert.ok(r.appended[0].style && r.appended[0].style.pointerEvents === 'none', 'må ikke fange klik eller blik');
  assert.ok(r.appended[0].style.position === 'fixed', 'må ikke påvirke layout');
  assert.strictEqual(r.replaced.length, 1);
  assert.strictEqual(r.replaced[0], '/');
  assert.ok(r.timers.length >= 1 && r.timers[0].ms >= 3000, 'bekræftelsen skal forsvinde af sig selv');
});

test('?taelmig fjerner flag og viser den anden tekst', function () {
  var LS = lager();
  LS.setItem('hojtArkade.ikkeTael', '1');
  var r = loadSettings({ LS: LS, search: '?taelmig', pathname: '/slangen/', hash: '#x' });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), null);
  assert.strictEqual(r.appended[0].textContent, 'Denne browser tælles med i statistikken igen.');
  assert.strictEqual(r.replaced[0], '/slangen/#x');
});

test('?ikketael bevarer andre parametre', function () {
  var r = loadSettings({ search: '?foo=1&ikketael&bar=2' });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), '1');
  assert.strictEqual(r.replaced[0], '/?foo=1&bar=2');
});

test('uden query sker der intet', function () {
  var r = loadSettings({ search: '' });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), null);
  assert.strictEqual(r.appended.length, 0);
  assert.strictEqual(r.replaced.length, 0);
});

test('?foo=ikketael udløser ikke fravalg', function () {
  var r = loadSettings({ search: '?foo=ikketael' });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), null);
  assert.strictEqual(r.appended.length, 0);
});

test('uden body vises bekræftelsen ved DOMContentLoaded', function () {
  var r = loadSettings({ search: '?ikketael', noBody: true });
  assert.strictEqual(r.LS.getItem('hojtArkade.ikkeTael'), '1');
  assert.strictEqual(r.appended.length, 1);
});

console.log(n - failed + ' af ' + n + ' test bestået');
process.exit(failed ? 1 : 0);
