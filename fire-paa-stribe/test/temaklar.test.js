// Tjekker reglen "Temaklar fra start": ingen farver, glød, skygger, skrifttyper,
// stregtykkelser eller hjørneradier i spillogik, tegnelag, layout-CSS eller markup.
// Al grafik ligger i tema/neon/. Kør: node fire-paa-stribe/test/temaklar.test.js
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
let ok = 0, fail = 0;
function check(name, cond, info) { if (cond) { ok++; console.log('OK   ' + name); } else { fail++; console.log('FEJL ' + name + (info ? ': ' + info : '')); } }
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/;
const VISUAL_CSS = /(^|[;{\s])(color|background[a-z-]*|border(-[a-z]+)*|outline[a-z-]*|box-shadow|text-shadow|filter|fill|stroke[a-z-]*|font-family|opacity)\s*:/;
const css = read('css/fire-paa-stribe.css').replace(/\/\*[\s\S]*?\*\//g, '');
const bad = css.split('\n').filter(l => COLOR.test(l) || /--glow/.test(l) || (VISUAL_CSS.test(l) && !/border:\s*0|outline:\s*none/.test(l)));
check('layout-CSS har ingen farver, glød, kanter eller skygger', bad.length === 0, bad.join(' | '));
['js/game.js', 'js/app.js', 'js/tegn.js'].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hits = s.split('\n').filter(l => COLOR.test(l) || /shadow|glow\b|strokeStyle|fillStyle|font\s*=/.test(l));
  check(f + ' har ingen farver eller glød', hits.length === 0, hits.join(' | '));
});
const game = read('js/game.js');
check('spillogikken kender ingen DOM eller grafik', !/document|window\.|classList|innerHTML|<svg|tema/i.test(game.replace(/typeof window !== 'undefined' \? window : globalThis/, '')));
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
check('markup har ingen inline style eller farver', !/style=|#[0-9a-fA-F]{3,8}\b(?!["'])|<path|<rect|<symbol/.test(html.replace(/href="#[^"]*"/g, '')));
check('markup henter temaets CSS og grafik', /tema\/neon\/tema\.css/.test(html) && /tema\/neon\/grafik\.js/.test(html));
global.window = undefined;
require(path.join(dir, 'tema/neon/grafik.js'));
const T = globalThis.FirePaaStribeTema;
const icons = [...html.matchAll(/data-ikon="([^"]+)"/g)].map(m => m[1]);
const missing = icons.filter(n => !T.ikoner[n]);
check('temaet leverer alle ikoner, markup beder om (' + [...new Set(icons)].join(', ') + ')', missing.length === 0, missing.join(', '));
check('temaet leverer brikker (hul og mini)', typeof T.brikker.hul === 'string' && typeof T.brikker.mini === 'function');
const tema = read('tema/neon/tema.css');
check('temaet kan slå glød fra', /data-gloed="fra"\]\s*\{\s*--glow:\s*0/.test(tema));
['.slot.p1 .disc', '.slot.p2 .disc', '.slot.ghost .disc', '.slot.tipslot .disc', '.slot.win .disc', '.board'].forEach(sel =>
  check('temaet tegner ' + sel, tema.includes(sel)));
console.log('\n' + ok + ' af ' + (ok + fail) + ' test bestået');
process.exit(fail ? 1 : 0);
