// POST /event tæller kun rigtige spillere – node api/test/event.test.js
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'worker.js'), 'utf8');

var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n     ') : e)); }
}

test('worker.js eksporterer skalTaelleEvent og svarer talt:false uden DB-skrivning', function () {
  assert.ok(/export function skalTaelleEvent\(origin, ua\)/.test(src));
  assert.ok(/if\s*\(\s*!skalTaelleEvent\(origin,\s*ua\)\s*\)\s*return json\(req,\s*\{\s*ok:\s*true,\s*talt:\s*false\s*\}\)/.test(src));
  assert.ok(/bot\|crawler\|spider\|headless\|playwright\|puppeteer\|lighthouse/.test(src));
  // DB-skrivningen kommer efter filteret
  var iFilter = src.indexOf('skalTaelleEvent(origin, ua)');
  var iBatch = src.indexOf('await env.DB.batch(st)');
  assert.ok(iFilter > 0 && iBatch > iFilter, 'DB.batch skal ligge efter filteret');
  // Highscore-endepunktet er uændret (stadig allowedOrigin, ikke det strikse origin-krav)
  var postScore = src.slice(src.indexOf('async function postScore'), src.indexOf('async function postEvent') > 0 ? src.indexOf('export function skalTaelleEvent') : src.length);
  // postScore står før skalTaelleEvent, så tag fra postScore til BOT_UA/skalTaelle
  postScore = src.slice(src.indexOf('async function postScore'), src.indexOf('export function skalTaelleEvent'));
  assert.ok(/allowedOrigin\(req\.headers\.get\('Origin'\)\)/.test(postScore));
  assert.ok(!/skalTaelleEvent/.test(postScore));
});

var m = src.match(/export function skalTaelleEvent\([\s\S]*?\n\}/);
assert.ok(m, 'skalTaelleEvent ikke fundet');
var ctx = {};
vm.runInNewContext(m[0].replace(/^export /, '') + '\nthis.skalTaelleEvent = skalTaelleEvent;', ctx);
var skal = ctx.skalTaelleEvent;

test('tæller kun Origin https://arkade.hojt.dk med almindelig UA', function () {
  var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  assert.strictEqual(skal('https://arkade.hojt.dk', ua), true);
});

test('localhost og 127.0.0.1 tælles ikke (CORS er uændret i cors())', function () {
  var ua = 'Mozilla/5.0 Chrome/120.0.0.0';
  assert.strictEqual(skal('http://localhost:8000', ua), false);
  assert.strictEqual(skal('http://localhost', ua), false);
  assert.strictEqual(skal('http://127.0.0.1:8787', ua), false);
  assert.strictEqual(skal('https://arkade.hojt.dk.evil.example', ua), false);
  assert.strictEqual(skal('https://evil.example/?https://arkade.hojt.dk', ua), false);
  assert.strictEqual(skal('', ua), false);
  assert.strictEqual(skal(null, ua), false);
  assert.ok(/allowedOrigin/.test(src) && /Access-Control-Allow-Origin/.test(src), 'CORS-hjælperen skal stadig være der');
});

test('HeadlessChrome og andre bot-markører tælles ikke', function () {
  var o = 'https://arkade.hojt.dk';
  assert.strictEqual(skal(o, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36'), false);
  assert.strictEqual(skal(o, 'Mozilla/5.0 Playwright'), false);
  assert.strictEqual(skal(o, 'Puppeteer'), false);
  assert.strictEqual(skal(o, 'lighthouse'), false);
  assert.strictEqual(skal(o, 'Googlebot/2.1'), false);
  assert.strictEqual(skal(o, 'compatible; bingbot/2.0'), false);
  assert.strictEqual(skal(o, 'SomeSpider'), false);
  assert.strictEqual(skal(o, 'crawler-test'), false);
  // almindelig Chrome skal stadig tælle – "chrome" matcher ikke mønsteret
  assert.strictEqual(skal(o, 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'), true);
  assert.strictEqual(skal(o, ''), true);
});

console.log(n - failed + ' af ' + n + ' test bestået');
process.exit(failed ? 1 : 0);
