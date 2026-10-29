// Tjekker reglen "Temaklar fra start": ingen farver, skygger eller skrifttyper i
// spillogik, tegnelag, lyd, app eller markup. Al grafik (teksturer, figurer, ikoner,
// overlays) ligger i tema/neon/, og layout-CSS må kun bruge temaets --kaelder-*-variabler.
// Kør: node kaelderen/test/temaklar.test.js
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
let ok = 0, fail = 0;
function check(name, cond, info) { if (cond) { ok++; console.log('OK   ' + name); } else { fail++; console.log('FEJL ' + name + (info ? ': ' + info : '')); } }
const COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![.\w])rgba?\(|hsla?\(|color-mix\(|\b(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey)\b(?!-)/;
const VISUAL = /(^|[;{\s])(color|background[a-z-]*|border(-[a-z]+)*-color|outline-color|box-shadow|text-shadow|filter|fill|stroke|font-family)\s*:\s*([^;]*)/;
const css = read('css/kaelderen.css').replace(/\/\*[\s\S]*?\*\//g, '');
const bad = css.split('\n').filter(l => {
  if (COLOR.test(l)) return true;
  const m = l.match(VISUAL);
  return m && !/var\(--|^\s*(none|transparent|currentColor|0|inherit)\s*!?/.test(m[4]);
});
check('layout-CSS har ingen farver; synlige egenskaber kommer fra variabler (--kaelder-* eller arkadens tema)', bad.length === 0, bad.join(' | '));
const used = [...new Set([...css.matchAll(/var\((--kaelder-[a-z0-9-]+)/g)].map(m => m[1]))];
const tema = read('tema/neon/tema.css');
const missingVars = used.filter(v => !tema.includes(v + ':'));
check('temaet definerer alle ' + used.length + ' --kaelder-*-variabler, layoutet bruger', missingVars.length === 0, missingVars.join(', '));
['js/logik.js', 'js/tegn.js', 'js/app.js', 'js/lyd.js'].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hits = s.split('\n').filter(l => COLOR.test(l) || /shadow|strokeStyle|fillStyle|\.font\s*=|fillText|strokeText/.test(l));
  check(f + ' har ingen farver, skygger, skrift eller vektortegning', hits.length === 0, hits.slice(0, 5).join(' | '));
});
['js/logik.js'].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/typeof window !== 'undefined' \? window : (globalThis|this)/g, '');
  check(f + ' kender ingen DOM eller grafik', !/document|window\.|classList|innerHTML|canvas|<svg|KaelderTema/i.test(s));
});
const tegn = read('js/tegn.js').replace(/\/\/.*$/gm, '');
check('tegn.js ændrer ikke spillets tilstand (kun læser)', !/\bst\.[a-zA-Z]+(\[[^\]]*\])?\s*(=[^=]|\+\+|--|\+=|-=)|\bst\.[a-zA-Z]+\.(push|splice|pop|shift|fill)\(/.test(tegn));
check('tegn.js tegner alt via temaets navngivne elementer', /KaelderTema/.test(tegn) && /T\.tegn\b/.test(tegn) && /teksturer/.test(tegn) && /sprites/.test(tegn));
// Arkadens dwell-ring (farver fra arkade.css) er den eneste tilladte figur i markup
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<circle class="arkade-dwell-[a-z]+"[^>]*>/g, '');
check('markup har ingen inline style eller farver', !/style=|#[0-9a-fA-F]{3,8}\b(?!["'])|<path|<rect|<circle/.test(html.replace(/href="#[^"]*"/g, '')));
check('markup henter temaets CSS og grafik', /tema\/neon\/tema\.css/.test(html) && /tema\/neon\/grafik\.js/.test(html));
global.window = undefined;
require(path.join(dir, 'tema/neon/grafik.js'));
const T = globalThis.KaelderTema;
check('temaet hedder neon og har farver, tal, teksturer, figurer, tegn og ikoner', T && T.navn === 'neon' && T.farver && T.tal && T.teksturer && T.sprites && T.tegn && T.ikoner);
const icons = [...(read('index.html') + read('js/app.js')).matchAll(/kaelder-ikon-([a-z-]+)/g)].map(m => m[1]).filter(n => n !== '');
const app = read('js/app.js');
// Ikoner, app.js sætter sammen ('kaelder-ikon-' + navn): alle værdier i IKON_FOR og VARE_IKON
const dyn = [...app.matchAll(/(IKON_FOR|VARE_IKON)\s*=\s*\{([^}]*)\}/g)].flatMap(m => [...m[2].matchAll(/:\s*'([a-z-]+)'/g)].map(x => x[1]));
const alle = [...new Set(icons.concat(dyn))];
const missing = alle.filter(n => !T.ikoner[n]);
check('temaet leverer alle ' + alle.length + ' ikoner, spillet beder om', missing.length === 0, missing.join(', '));
const texNavne = [...new Set([...tegn.matchAll(/tex\['([a-z-]+)'\]/g)].map(m => m[1]))];
check('temaet leverer alle teksturer (' + texNavne.join(', ') + ')', texNavne.every(n => typeof T.teksturer[n] === 'function' || (T.teksturer[n] && typeof T.teksturer[n].tegn === 'function')), texNavne.filter(n => !T.teksturer[n]).join(', '));
['kravler', 'skytte', 'kolos', 'ammo', 'liv', 'skat', 'noegle', 'trappe', 'lampe'].forEach(n =>
  check('temaet har figuren ' + n, T.sprites[n] && typeof T.sprites[n].tegn === 'function'));
['livbar', 'trussel', 'markering', 'feltMarkering', 'sigtekorn', 'vaaben', 'skade', 'efter', 'tal', 'kortBund', 'kortFelt', 'kortSpiller', 'kortFjende', 'kortTing', 'kortRute', 'kortValg', 'kortTekst'].forEach(k =>
  check('temaet tegner ' + k, typeof T.tegn[k] === 'function'));
const farver = T.farver.map ? T.farver : Object.keys(T.farver);
const missingCol = farver.filter(f => !tema.includes('--kaelder-' + f + ':'));
check('alle ' + farver.length + ' temafarver er --kaelder-*-variabler i tema.css', missingCol.length === 0, missingCol.join(', '));
const tal = T.tal.map ? T.tal : Object.keys(T.tal);
const missingTal = tal.filter(t => !tema.includes('--kaelder-' + t + ':'));
check('alle temaets tal (lys, tåge, glød …) er --kaelder-*-variabler i tema.css', missingTal.length === 0, missingTal.join(', '));
check('temaet kan slå glød fra (og bloom og scanlines med)', /data-kaelder-gloed="fra"\][^{]*\{[^}]*--kaelder-gloed:[^}]*--kaelder-bloom:\s*0/.test(tema));
check('flimmer er blødt (højst 10 %) og står i temaet', /--kaelder-flimmer:\s*0?\.0\d/.test(tema));
const g = read('tema/neon/grafik.js');
check('tekst på billedet har kontrastkant (kan aflæses uden farver)', /fillText/.test(g) && /strokeText/.test(g) && /tekst-kant/.test(g));
check('temaet har en lyd-tabel (tom = spillets egne lyde)', T.lyde && typeof T.lyde === 'object');
// Farvesættene i arkaden: alle sæt har de vigtigste farver
['neon', 'solnedgang', 'cyberpunk', 'kontrast'].forEach(t => {
  if (t === 'neon') return;
  check('farvesættet ' + t + ' findes i tema.css', tema.includes('[data-theme="' + t + '"]'));
});
console.log('\n' + ok + ' af ' + (ok + fail) + ' test bestået');
process.exit(fail ? 1 : 0);
