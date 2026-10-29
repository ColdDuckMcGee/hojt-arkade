// Tjekker reglen "Temaklar fra start": ingen hardkodede farver, glød, skygger, skrifttyper,
// stregtykkelser eller hjørneradier i spillogik, tegnelag, layout-CSS eller markup – kun
// CSS-variabler. Al grafik ligger i tema/neon/. Kør: node kabalen/test/temaklar.test.js
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
let ok = 0, fail = 0;
function check(name, cond, info) { if (cond) { ok++; console.log('OK   ' + name); } else { fail++; console.log('FEJL ' + name + (info ? ': ' + info : '')); } }
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/;
const NAMED = /:\s*(white|black|red|blue|green|yellow|magenta|cyan)\b/;
// Synlige egenskaber skal komme fra en variabel (eller være slået fra). Skriftvægt og -størrelse
// på menuernes tekst følger arkade.css; pladens tal får vægt fra temaet.
const VISUAL = /(^|[;{\s])(color|background(-color|-image)?|border(-[a-z]+)*|outline(-color)?|box-shadow|text-shadow|filter|fill|stroke(-width|-dasharray)?|font-family|border-radius|-webkit-text-stroke)\s*:\s*([^;}]*)/g;
const OFF = /^(none|0|0px|transparent|inherit|currentColor|unset|initial)(\s*!important)?$/i;
const css = noComments(read('css/kabalen.css'));
const bad = [];
css.split('\n').forEach(l => {
  if (COLOR.test(l) || NAMED.test(l)) bad.push(l.trim());
  let m; VISUAL.lastIndex = 0;
  while ((m = VISUAL.exec(l))) { const v = m[m.length - 1].trim(); if (!/var\(/.test(v) && !OFF.test(v) && !/^\d+px solid var\(|^0 /.test(v)) bad.push(l.trim()); }
});
check('layout-CSS bruger kun temaets variabler til farver, glød, kanter, skrift og radier', bad.length === 0, [...new Set(bad)].slice(0, 6).join(' | '));
['js/logik.js', 'js/app.js', 'js/tegn.js', 'js/lyd.js'].forEach(f => {
  const s = noComments(read(f)).replace(/\/\/.*$/gm, '');
  const hits = s.split('\n').filter(l => COLOR.test(l.replace(/'[^']*'/g, m => /#[0-9a-f]{3,8}\b|rgb/i.test(m) ? m : "''")) || /shadow|glow\b|strokeStyle|fillStyle|\.style\.(color|background|border|font)/.test(l));
  check(f + ' har ingen farver, skygger eller glød', hits.length === 0, hits.join(' | '));
});
const game = read('js/logik.js');
check('spillogikken kender ingen DOM eller grafik', !/document|classList|innerHTML|<svg|KabaleTema|getComputedStyle/.test(game));
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
check('markup har ingen inline style, farver eller tegnede figurer', !/style=|<path|<rect|<symbol|<circle/.test(html) && !COLOR.test(html.replace(/href="#[^"]*"/g, '').replace(/content="#[0-9a-fA-F]+"/g, '')));
check('markup henter temaets CSS og grafik', /tema\/neon\/tema\.css/.test(html) && /tema\/neon\/grafik\.js/.test(html));
global.window = undefined;
require(path.join(dir, 'tema/neon/grafik.js'));
const T = globalThis.KabaleTema;
const wanted = new Set([...html.matchAll(/#ka-ikon-([a-z]+)/g)].map(m => m[1]));
[...read('js/tegn.js').matchAll(/ka-ikon-' *\+ *'?([a-z]*)|ikon\('([a-z]+)'/g)].forEach(m => { if (m[2]) wanted.add(m[2]); });
const missing = [...wanted].filter(n => !T.ikoner[n]);
check('temaet leverer alle ikoner, spillet beder om (' + [...wanted].join(', ') + ')', missing.length === 0, missing.join(', '));
// Alle --su-variabler, som layoutet bruger, skal findes i temaet (undtagen layout-tal fra JS)
const tema = read('tema/neon/tema.css');
const LAYOUT_VARS = new Set(['--ka-cw', '--ka-ch', '--ka-idx', '--ka-idx-tynd', '--ka-badge']);
const used = new Set([...css.matchAll(/var\((--ka-[a-z0-9-]+)/g)].map(m => m[1]).filter(v => !LAYOUT_VARS.has(v)));
const undef = [...used].filter(v => !new RegExp(v + '\\s*:').test(tema));
check('temaet definerer alle ' + used.size + ' variabler, layoutet bruger', undef.length === 0, undef.join(', '));
check('temaet kan slå glød fra', /data-ka-gloed="fra"\][^{]*\{[^}]*--glow:\s*0/.test(tema));
const glows = [...tema.matchAll(/(--ka-[a-z-]*glow[a-z-]*)\s*:/g)].map(m => m[1]);
const offBlock = (tema.match(/data-ka-gloed="fra"\][^{]*\{([^}]*)\}/) || [])[1] || '';
const notOff = [...new Set(glows)].filter(g => !new RegExp(g + '\\s*:\\s*none').test(offBlock));
check('alle glød- og skyggevariabler slås fra med glød fra', notOff.length === 0, notOff.join(', '));
['neon', 'solnedgang', 'cyberpunk', 'kontrast'].slice(1).forEach(t =>
  check('temaet har farver til arkadens tema ' + t, new RegExp('data-theme="' + t + '"').test(tema)));

// Kulører og bagside: temaet leverer alle fire kulører og bagsiden ved navn, og røde kulører
// kan skelnes uden farve (de er hule: et indre felt i kortets baggrundsfarve).
const L = (global.window = undefined, require(path.join(dir, 'js/logik.js')), globalThis.KabaleLogik);
const kmiss = L.KULOR.filter(n => !T.kulorer[n]);
check('temaet leverer alle fire kulører (' + L.KULOR.join(', ') + ') og bagsiden', kmiss.length === 0 && typeof T.bagside === 'string' && T.bagside.length > 0, kmiss.join(', '));
check('røde kulører er hule og sorte fyldte (kan skelnes uden farve)', /ks-ind/.test(T.kulorer.hjerter) && /ks-ind/.test(T.kulorer.ruder) && !/ks-ind/.test(T.kulorer.spar) && !/ks-ind/.test(T.kulorer.klor));
check('temaets grafik har ingen farver (de kommer fra tema.css)', !COLOR.test(JSON.stringify(T)));
check('tegnelaget henter kulører og bagside ved navn', /ka-kulor-/.test(read('js/tegn.js')) && /ka-bagside/.test(read('js/tegn.js')));
console.log('\n' + ok + ' af ' + (ok + fail) + ' test bestået');
process.exit(fail ? 1 : 0);
