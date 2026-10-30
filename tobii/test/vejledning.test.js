// Test af Tobii-vejledningen (/tobii/) og linkene til den, uden browser: node tobii/test/vejledning.test.js
// Layout (mål på mindst 84 px, ingen vandret rulning, hop-knapper) testes med Playwright i
// hal/test/velkomst_test.py (velkomstskærmen) og manuelt med skærmbilleder.
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.message)); }
}
var side = read('tobii/index.html');
var hal = read('index.html');
var velkomst = (hal.match(/<main id="velkomst"[\s\S]*?<\/main>/) || [''])[0];
function labels() {
  return (velkomst.match(/<span class="valg-titel">([^<]+)<\/span>/g) || []).map(function (s) { return s.replace(/<[^>]+>/g, ''); });
}

test('siden er dansk og bruger arkadens fælles CSS', function () {
  assert.ok(/<html lang="da"/.test(side));
  assert.ok(/href="\.\.\/arkade\/arkade\.css"/.test(side));
  assert.ok(/href="vejledning\.css"/.test(side));
  assert.ok(fs.existsSync(path.join(ROOT, 'tobii', 'vejledning.css')));
});
test('"Tilbage til arkaden" øverst og nederst', function () {
  var m = side.match(/<a class="btn primary v-tilbage" href="\.\.\/">[\s\S]*?Tilbage til arkaden/g) || [];
  assert.strictEqual(m.length, 2);
});
test('hop-knapper peger på afsnit, der findes', function () {
  var hops = (side.match(/href="#([a-z0-9-]+)"/g) || []).map(function (s) { return s.slice(7, -1); });
  assert.ok(hops.length >= 10, 'for få hop-knapper');
  hops.forEach(function (id) { assert.ok(new RegExp('id="' + id + '"').test(side), 'mangler id="' + id + '"'); });
  ['kort', 'trin1', 'trin2', 'tips', 'snap', 'grid', 'kilder'].forEach(function (id) {
    assert.ok(side.indexOf('href="#' + id + '"') >= 0, 'indholdet mangler ' + id);
  });
});
test('valgene på velkomstskærmen er stavet præcis som i hallen', function () {
  var navne = labels();
  assert.ok(navne.indexOf('Øjenstyring med kigge‑klik') >= 0 && navne.indexOf('Øjenstyring med mit eget program') >= 0, navne.join(' | '));
  assert.ok(side.indexOf('<strong class="v-label">Øjenstyring med kigge‑klik</strong>') >= 0);
  assert.ok(side.indexOf('<strong class="v-label">Øjenstyring med mit eget program</strong>') >= 0);
});
test('kerneindhold: Repeat Click, Left Click, F2, Continuous Mode, TD Snap, Grid 3', function () {
  ['Repeat Click', 'Left Click', 'Startup', 'F2', 'Continuous Mode', 'Click on Fixation', 'Launch Application',
   '--app=https://arkade.hojt.dk/', 'Toggle Desktop Access', 'Dwell to click', 'Move pointer, no click', 'Start program'].forEach(function (t) {
    assert.ok(side.indexOf(t) >= 0, 'mangler: ' + t);
  });
  assert.ok(/kan de hedde noget andet/.test(side), 'mangler note om engelske navne');
  assert.ok((side.match(/Ikke afprøvet endnu/g) || []).length >= 3, 'utestede ting skal mærkes');
});
test('kilder er https-links', function () {
  var kilder = (side.match(/<ul class="v-kilder">[\s\S]*?<\/ul>/g) || []).join('');
  var links = kilder.match(/href="([^"]+)"/g) || [];
  assert.ok(links.length >= 10);
  links.forEach(function (l) { assert.ok(/href="https:\/\//.test(l), l); });
});
test('velkomstskærmen og Indstillinger linker til vejledningen', function () {
  assert.ok(/<a class="btn velkomst-tobii" id="velkomst-tobii" href="tobii\/">[\s\S]*?Bruger du Tobii Dynavox\?[\s\S]*?Brug TD Control i stedet for TD Browse – se vejledning/.test(velkomst));
  assert.ok(/id="btn-tobii-vejledning" href="tobii\/"/.test(hal));
  assert.ok(/velkomst-tobii'\)\.hidden = n !== 1/.test(read('hal/hal.js')), 'linket skal kun vises på trin 1');
});
test('TD Browse-boksen i dwell.js har et link til vejledningen', function () {
  var d = read('arkade/dwell.js');
  assert.ok(/new URL\('\.\.\/tobii\/', cs\.src\)/.test(d));
  assert.ok(/arkade-td-vejledning/.test(d) && /minHeight: '84px'/.test(d));
});
console.log(n + ' tests, ' + failed + ' fejl');
process.exit(failed ? 1 : 0);
