// Test af velkomstskærmen "Hvordan styrer du?" uden browser: node hal/test/velkomst.test.js
// Markup (fire valg, tre kigge-tider, Skift styring, ingen fagord), at alle spil læser den
// fælles kigge-klik-indstilling og indlæser taster.js, og taster.js' styring/autofokus.
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
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
}
var html = read('index.html');
var velkomst = (html.match(/<main id="velkomst"[\s\S]*?<\/main>/) || [''])[0];
var GAMES = fs.readdirSync(ROOT).filter(function (d) { return fs.existsSync(path.join(ROOT, d, 'js', 'app.js')); }).sort();

// ---------- Markup ----------
test('velkomstskærmen findes og er skjult fra start', function () {
  assert.ok(velkomst, 'mangler <main id="velkomst">');
  assert.ok(/<main id="velkomst" class="screen[^"]*"\s+hidden/.test(velkomst), 'skal være skjult indtil hal.js viser den');
  assert.ok(/Hvordan styrer du\?/.test(velkomst));
});
test('fire valg med ikon, titel og én forklaringslinje', function () {
  var valg = velkomst.match(/<button[^>]*data-styring="[a-z]+"[\s\S]*?<\/button>/g) || [];
  assert.deepStrictEqual(valg.map(function (b) { return b.match(/data-styring="([a-z]+)"/)[1]; }), ['mus', 'kigge', 'eget', 'kontakt']);
  valg.forEach(function (b) {
    assert.ok(/class="valg-ikon"/.test(b) && /class="valg-titel"/.test(b) && /class="valg-tekst"/.test(b), b.slice(0, 60));
  });
  assert.ok(/data-styring="mus"[^>]*data-autofokus|data-autofokus[^>]*data-styring="mus"/.test(velkomst), 'første valg skal have autofokus');
});
test('tre kigge-tider (kort/mellem/lang) og en Tilbage-knap', function () {
  var tider = (velkomst.match(/data-tid="([\d.]+)"/g) || []).map(function (s) { return +s.match(/[\d.]+/)[0]; });
  assert.deepStrictEqual(tider, [0.8, 1.2, 2]);
  ['Kort', 'Mellem', 'Lang'].forEach(function (t) { assert.ok(velkomst.indexOf('>' + t + '<') >= 0, t); });
  assert.ok(/id="velkomst-tilbage"/.test(velkomst));
});
test('ingen fagord (dwell) i teksterne; kigge-klik bruges', function () {
  var tekst = velkomst.replace(/<[^>]+>/g, ' ');
  assert.ok(!/dwell/i.test(tekst), 'ordet "dwell" står i velkomstteksten');
  assert.ok(/kigge.klik/.test(tekst));
  assert.ok(/TD Browse/.test(tekst) && /Grid 3/.test(tekst) && /Tobii/.test(tekst));
});
test('Indstillinger har "Skift styring" og viser valget', function () {
  assert.ok(/id="btn-skift-styring"[^>]*>[^<]*Skift styring/.test(html) || /id="btn-skift-styring"[\s\S]{0,200}Skift styring/.test(html));
  assert.ok(/id="styring-navn"/.test(html));
  assert.ok(/id="hal-besked"[^>]*role="status"|role="status"[^>]*id="hal-besked"/.test(html), 'bekræftelsen skal læses op (role=status)');
});
test('knapperne er mindst 84 px høje i CSS', function () {
  var css = read('hal/hal.css');
  assert.ok(/\.btn\.valg\s*\{[^}]*min-height:\s*84px/.test(css));
  assert.ok(/minmax\(84px/.test(css));
});

// ---------- Alle spil læser den fælles indstilling ----------
test('der er 27 spil', function () { assert.strictEqual(GAMES.length, 27, GAMES.join(',')); });
GAMES.forEach(function (g) {
  test(g + ': fælles kigge-klik-indstilling + taster.js', function () {
    var app = read(g + '/js/app.js'), idx = read(g + '/index.html');
    assert.ok(/ArkadeSettings\.create\('arkade',\s*\{[\s\S]*?dwell:[\s\S]*?dwellTime:/.test(app), 'læser ikke arkade.dwell/dwellTime');
    assert.ok(/ArkadeDwell\.create\(/.test(app), 'bruger ikke ArkadeDwell');
    assert.ok(/\.\.\/arkade\/taster\.js/.test(idx), 'indlæser ikke taster.js');
    assert.ok(/\.\.\/arkade\/arkade\.css/.test(idx), 'indlæser ikke arkade.css');
    assert.ok(/\.\.\/arkade\/dwell\.js/.test(idx), 'indlæser ikke dwell.js');
  });
});
test('hallen bruger samme indstilling og gemmer valget for sig', function () {
  var hal = read('hal/hal.js');
  assert.ok(/ArkadeSettings\.create\('arkade'/.test(hal));
  assert.ok(/ArkadeSettings\.create\('styring',\s*\{\s*valg:\s*''\s*\}\)/.test(hal));
  assert.ok(/isTdBrowse\(\)/.test(hal), 'TD Browse skal genkendes');
});

// ---------- taster.js ----------
function el(id, opts) {
  opts = opts || {};
  return { id: id, nodeType: 1, tagName: 'BUTTON', hidden: false, disabled: !!opts.disabled, parentNode: null, attrs: opts.attrs || {},
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute: function (k, v) { this.attrs[k] = String(v); }, removeAttribute: function (k) { delete this.attrs[k]; },
    hasAttribute: function (k) { return k in this.attrs; },
    matches: function (sel) { return sel === '.screen' ? !!opts.screen : false; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: opts.w || 100, height: 100 }; },
    focus: function () { doc.activeElement = this; } };
}
var doc, win;
function load(stored, extra) {
  var start = el('btn-start'), other = el('btn-x'), auto = el('btn-auto', { attrs: { 'data-autofokus': '' } });
  var list = extra === 'auto' ? [auto] : extra === 'ingen' ? [] : [start];
  var screen = el('menu', { screen: true });
  screen.querySelectorAll = function (sel) { return /autofokus/.test(sel) ? list : [other, start]; };
  var root = el('html');
  doc = { documentElement: root, body: { nodeType: 1 }, activeElement: null, addEventListener: function () {},
    querySelectorAll: function (sel) { return sel === '.screen' ? [screen] : []; } };
  doc.activeElement = doc.body;
  var store = {}; if (stored !== undefined) store['hojtArkade.styring.indstillinger'] = stored;
  var timers = [], loads = [];
  win = { document: doc, localStorage: { getItem: function (k) { return k in store ? store[k] : null; } },
    addEventListener: function (t, fn) { if (t === 'load') loads.push(fn); }, setTimeout: function (fn) { timers.push(fn); },
    getComputedStyle: function () { return { visibility: 'visible', display: 'block' }; } };
  vm.runInNewContext(read('arkade/taster.js').replace('})(this);', '})(win);'), { win: win });
  return { run: function () { loads.forEach(function (f) { f(); }); timers.forEach(function (f) { f(); }); }, start: start, other: other, auto: auto };
}
test('taster.js: valget fra hallen sættes som data-styring på <html>', function () {
  load(JSON.stringify({ valg: 'kontakt' }));
  assert.strictEqual(doc.documentElement.getAttribute('data-styring'), 'kontakt');
  assert.strictEqual(win.ArkadeTaster.styring(), 'kontakt');
  load(undefined); assert.strictEqual(doc.documentElement.getAttribute('data-styring'), null);
  load('{ikke json'); assert.strictEqual(win.ArkadeTaster.styring(), '');
  load(JSON.stringify({ valg: 'kigge' })); win.ArkadeTaster.setStyring(''); assert.strictEqual(doc.documentElement.getAttribute('data-styring'), null);
});
test('taster.js: kontakt → Start får fokus efter indlæsning', function () {
  var t = load(JSON.stringify({ valg: 'kontakt' })); t.run();
  assert.strictEqual(doc.activeElement, t.start);
  t = load(JSON.stringify({ valg: 'kontakt' }), 'auto'); t.run();
  assert.strictEqual(doc.activeElement, t.auto, 'data-autofokus vælges først');
  t = load(JSON.stringify({ valg: 'kontakt' }), 'ingen'); t.run();
  assert.strictEqual(doc.activeElement, t.other, 'ellers første knap');
});
test('taster.js: ingen autofokus for mus/kigge/eget eller hvis noget allerede har fokus', function () {
  ['mus', 'kigge', 'eget', ''].forEach(function (v) {
    var t = load(JSON.stringify({ valg: v })); t.run(); assert.strictEqual(doc.activeElement, doc.body, v);
  });
  var t = load(JSON.stringify({ valg: 'kontakt' })); doc.activeElement = t.other; t.run();
  assert.strictEqual(doc.activeElement, t.other);
  t = load(JSON.stringify({ valg: 'mus' })); assert.strictEqual(win.ArkadeTaster.autofokus(true), true, 'tving virker altid');
});

console.log('\n' + (n - failed) + '/' + n + ' tests OK' + (failed ? ', ' + failed + ' FEJL' : ''));
process.exitCode = failed ? 1 : 0;
