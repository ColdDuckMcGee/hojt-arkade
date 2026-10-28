// Tjekker reglen "Temaklar fra start": ingen farver, skygger eller skrifttyper i
// spillogik, computer, tegnelag, app eller markup. Al grafik ligger i tema/neon/,
// og layout-CSS må kun bruge temaets --billard-*-variabler.
// Kør: node billard/test/temaklar.test.js
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
let ok = 0, fail = 0;
function check(name, cond, info) { if (cond) { ok++; console.log('OK   ' + name); } else { fail++; console.log('FEJL ' + name + (info ? ': ' + info : '')); } }
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix\(|\b(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey)\b(?!-)/;
const VISUAL = /(^|[;{\s])(color|background[a-z-]*|border(-[a-z]+)*-color|outline-color|box-shadow|text-shadow|filter|fill|stroke|font-family)\s*:\s*([^;]*)/;
const css = read('css/billard.css').replace(/\/\*[\s\S]*?\*\//g, '');
const bad = css.split('\n').filter(l => {
  if (COLOR.test(l)) return true;
  const m = l.match(VISUAL);
  return m && !/var\(--|^\s*(none|transparent|currentColor|0|inherit)\s*!?/.test(m[4]);
});
check('layout-CSS har ingen farver; synlige egenskaber kommer fra variabler (--billard-* eller arkadens tema)', bad.length === 0, bad.join(' | '));
const used = [...new Set([...css.matchAll(/var\((--billard-[a-z0-9-]+)/g)].map(m => m[1]))];
const tema = read('tema/neon/tema.css');
const missingVars = used.filter(v => !tema.includes(v + ':'));
check('temaet definerer alle ' + used.length + ' --billard-*-variabler, layoutet bruger', missingVars.length === 0, missingVars.join(', '));
['js/logik.js', 'js/ai.js', 'js/tegn.js', 'js/app.js'].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hits = s.split('\n').filter(l => COLOR.test(l) || /shadow|strokeStyle|fillStyle|\.font\s*=/.test(l));
  check(f + ' har ingen farver, skygger eller skrift', hits.length === 0, hits.slice(0, 5).join(' | '));
});
['js/logik.js', 'js/ai.js'].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/typeof window !== 'undefined' \? window : (globalThis|this)/g, '');
  check(f + ' kender ingen DOM eller grafik', !/document|window\.|classList|innerHTML|canvas|<svg|BillardTema/i.test(s));
});
const tegn = read('js/tegn.js');
check('tegn.js ændrer ikke spillets tilstand (kun læser)', !/state\.[a-zA-Z]+\s*(=[^=]|\+\+|--|\+=|-=)|\.(push|splice|pop|shift)\(\s*\)?.*state\./.test(tegn.replace(/\/\/.*$/gm, '')));
check('tegn.js tegner alt via temaets navngivne elementer', /BillardTema/.test(tegn) && /\.tegn\b|tegn\[/.test(tegn));
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
check('markup har ingen inline style eller farver', !/style=|#[0-9a-fA-F]{3,8}\b(?!["'])|<path|<rect|<circle/.test(html.replace(/href="#[^"]*"/g, '')));
check('markup henter temaets CSS og grafik', /tema\/neon\/tema\.css/.test(html) && /tema\/neon\/grafik\.js/.test(html));
global.window = undefined;
require(path.join(dir, 'tema/neon/grafik.js'));
const T = globalThis.BillardTema;
check('temaet hedder neon og har farver, tal, tegn og ikoner', T && T.navn === 'neon' && T.farver && T.tal && T.tegn && T.ikoner);
const icons = [...(read('index.html') + read('js/app.js')).matchAll(/billard-ikon-([a-z-]+)/g)].map(m => m[1]);
const missing = icons.filter(n => !T.ikoner[n]);
check('temaet leverer alle ikoner, spillet beder om (' + [...new Set(icons)].join(', ') + ')', missing.length === 0, [...new Set(missing)].join(', '));
['bord', 'filt', 'hul', 'bande', 'kugle', 'maal', 'haand', 'koe', 'sigte'].forEach(k =>
  check('temaet tegner ' + k, typeof T.tegn[k] === 'function'));
const farver = T.farver.map ? T.farver : Object.keys(T.farver);
const missingCol = [];
for (let i = 1; i <= 15; i++) if (!tema.includes('--billard-kugle-' + i + ':')) missingCol.push('kugle-' + i);
farver.forEach(f => { if (!tema.includes('--billard-' + f + ':')) missingCol.push(f); });
check('alle temaets farver er --billard-*-variabler i tema.css', missingCol.length === 0, missingCol.join(', '));
const tal = T.tal.map ? T.tal : Object.keys(T.tal);
const missingTal = tal.filter(t => !tema.includes('--billard-' + t + ':'));
check('alle temaets mål er --billard-*-variabler i tema.css', missingTal.length === 0, missingTal.join(', '));
check('temaet kan slå glød fra', /data-billard-gloed="fra"\][^{]*\{[^}]*--billard-gloed:\s*0/.test(tema));
check('kontrast-temaet har ingen glød og tydelige konturer', /\[data-theme="kontrast"\][^{]*\{[^}]*--billard-gloed:\s*0/.test(tema));
// Kuglerne kan skelnes uden farver: alle har tal, de halve har striber
const g = read('tema/neon/grafik.js');
check('kuglerne har tal og striber (kan skelnes uden farver)', /stribe/.test(g) && /fillText/.test(g));
console.log('\n' + ok + ' af ' + (ok + fail) + ' test bestået');
process.exit(fail ? 1 : 0);
