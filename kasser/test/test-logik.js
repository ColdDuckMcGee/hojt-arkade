/*
 * Kasser – logiktest uden browser.  Kør:  node kasser/test/test-logik.js
 * Tjekker banerne (størrelse, lukkede mure, løselige med løseren, par), bevægelse, skub,
 * blokeret skub (væg og to kasser i træk), fortryd, genstart, tryk-på-felt (korteste vej),
 * fastlåste kasser, banesejr og point, fremskridt (låst op, bedste resultat), runder,
 * "Afslut runde" (= game over) og top 10.
 */
'use strict';
var path = require('path');
var store = {};
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }
};
var ROD = process.env.KASSER_ROD || path.join(__dirname, '..');   // mappen kasser/
require(path.join(ROD, 'js/baner.js'));
require(path.join(ROD, 'js/game.js'));
require(path.join(ROD, '../arkade/highscores.js'));
var Solver = require(path.join(ROD, 'test/solver.js'));
var G = globalThis.KasserGame, B = globalThis.KasserBaner;

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('  FEJL: ' + msg); } }
function section(name) { console.log('- ' + name); }
function lvl(rows) { return G.createLevel(0, { par: 1, rows: rows }); }
function pos(g) { return g.xy(g.state.player); }
var M = { u: 'up', d: 'down', l: 'left', r: 'right' };

// ---------- 1. Banerne ----------
section('banerne');
ok(B.length >= 30, 'mindst 30 baner (' + B.length + ')');
var prevBoxes = 0, sumPar = 0;
B.forEach(function (def, n) {
  var name = 'bane ' + (n + 1), rows = def.rows, h = rows.length, w = Math.max.apply(null, rows.map(function (r) { return r.length; }));
  ok(w <= 8 && h <= 8, name + ' er højst 8 × 8 (' + w + ' × ' + h + ')');
  var text = rows.join(''), boxes = (text.match(/[$*]/g) || []).length, goals = (text.match(/[.*+]/g) || []).length;
  ok((text.match(/[@+]/g) || []).length === 1, name + ' har én lagerarbejder');
  ok(boxes >= 1 && boxes === goals, name + ' har lige mange kasser og mål');
  ok(/^[#\-\s.$*@+]+$/.test(text), name + ' bruger kun kendte tegn');
  // lukket: intet gulv ved kanten eller ved siden af tomt udenfor
  var open = true;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var c = rows[y][x] || '-';
    if (c === '#' || c === '-') continue;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nx = x + d[0], ny = y + d[1], nc = (rows[ny] || '')[nx];
      if (nc === undefined || nc === '-') open = false;
    });
  }
  ok(open, name + ' er lukket af mure');
  var sol = Solver.solve(rows);
  ok(sol && !sol.tooBig, name + ' kan løses af løseren');
  if (sol && !sol.tooBig) {
    ok(sol.moves === def.par, name + ': par ' + def.par + ' = korteste løsning ' + sol.moves);
    ok(sol.pushes === def.skub, name + ': skub ' + def.skub + ' = ' + sol.pushes);
    // spil løsningen i spillets egen logik
    var g = G.createLevel(n), last = null;
    sol.path.split('').forEach(function (m) { last = g.move(M[m]); });
    ok(g.state.solved && last && last.solved, name + ': løsningen virker i spillet');
    ok(g.state.moves === def.par, name + ': træk tælles rigtigt');
    ok(g.points() === G.maxPoints(n), name + ': par giver fulde point');
    sumPar += sol.moves;
  }
  var g0 = G.createLevel(n);
  ok(g0.stuckBoxes().length === 0, name + ': ingen fastlåste kasser fra start');
  ok(!g0.isSolved(), name + ': er ikke løst fra start');
});
ok(B[0].par < B[B.length - 1].par, 'sidste bane er sværere end første');
var firstHalf = B.slice(0, 10).reduce(function (a, d) { return a + d.par; }, 0), lastHalf = B.slice(-10).reduce(function (a, d) { return a + d.par; }, 0);
ok(lastHalf > firstHalf * 2, 'de sidste ti baner er klart sværere end de første ti (' + firstHalf + ' / ' + lastHalf + ')');

// ---------- 2. Bevægelse ----------
section('bevægelse');
(function () {
  var g = lvl(['#######', '#@    #', '#  $ .#', '#######']);
  var r = g.move('right');
  ok(r.moved && !r.pushed && pos(g).x === 2 && g.state.moves === 1, 'et skridt til højre');
  r = g.move('up');
  ok(!r.moved && r.bump === 'wall' && g.state.moves === 1, 'væg: intet sker, intet træk');
  r = g.move('down'); r = g.move('left');
  ok(pos(g).x === 1 && pos(g).y === 2 && g.state.moves === 3, 'ned og til venstre');
  ok(g.state.dir === 'left', 'retningen huskes');
})();

// ---------- 3. Skub og blokeret skub ----------
section('skub');
(function () {
  var g = lvl(['#######', '#@$  .#', '#######']);
  var r = g.move('right');
  ok(r.moved && r.pushed && r.box.from === g.idx(2, 1) && r.box.to === g.idx(3, 1), 'kassen skubbes ét felt');
  ok(g.state.pushes === 1 && g.state.moves === 1, 'skub tælles');
  g.move('right'); r = g.move('right');
  ok(r.box.onGoal && r.solved && g.state.solved, 'kasse på mål løser banen');
  ok(g.move('left').ignored, 'efter sejr ignoreres træk');
  // kasse mod væg
  g = lvl(['#####', '#@$#', '#. #', '#####']);
  r = g.move('right');
  ok(!r.moved && r.bump === 'box' && r.behind === 'wall', 'kasse mod væg kan ikke skubbes');
  ok(g.state.moves === 0 && g.state.boxes[0] === g.idx(2, 1), 'intet ændret ved blokeret skub');
  // to kasser i træk
  g = lvl(['#######', '#@$$ ..#', '#######']);
  r = g.move('right');
  ok(!r.moved && r.bump === 'box' && r.behind === 'box', 'to kasser i træk kan ikke skubbes');
  ok(g.state.moves === 0 && pos(g).x === 1, 'ingen træk ved to kasser');
  ok(g.check('right').kind === 'box' && g.check('down').kind === 'wall', 'check() fortæller hvad der sker');
})();

// ---------- 4. Fortryd og genstart ----------
section('fortryd og genstart');
(function () {
  var g = lvl(['########', '#@ $  .#', '#      #', '########']);
  ok(!g.canUndo() && !g.undo(), 'intet at fortryde fra start');
  var start = JSON.stringify(g.state);
  ['right', 'right', 'down', 'right', 'right'].forEach(function (d) { g.move(d); });
  ok(g.state.boxes[0] === g.idx(4, 1) && g.state.moves === 5 && g.state.pushes === 1, 'fem træk med ét skub');
  g.move('down');   // væg: tæller ikke og kan ikke fortrydes
  ok(g.undo() && g.state.moves === 4 && pos(g).x === 4 && pos(g).y === 2, 'fortryd ét træk');
  ok(g.undo() && g.undo() && g.state.boxes[0] === g.idx(4, 1) && g.undo() && g.state.boxes[0] === g.idx(3, 1) && g.state.pushes === 0, 'fortryd et skub flytter kassen tilbage');
  while (g.undo()) { /* ubegrænset */ }
  ok(JSON.stringify(g.state) === start, 'ubegrænset fortryd tilbage til start');
  g.move('right'); g.move('right');
  ok(g.restart() && g.state.moves === 0 && g.state.boxes[0] === g.idx(3, 1) && pos(g).x === 1, 'genstart');
  ok(g.undo() && g.state.moves === 2, 'genstart kan fortrydes');
  for (var i = 0; i < 500; i++) g.move(i % 2 ? 'left' : 'right');
  var c = 0; while (g.undo()) c++;
  ok(c === 502 && g.state.moves === 0, 'mange træk kan alle fortrydes (' + c + ')');
})();

// ---------- 5. Tryk på et felt ----------
section('tryk på et felt');
(function () {
  var g = lvl(['#######', '#@ #  #', '#  $ .#', '#     #', '#######']);
  var r = g.walkTo(4, 1);
  ok(r.steps.length === 7 && pos(g).x === 4 && pos(g).y === 1, 'korteste vej uden om kassen (' + r.steps.length + ' skridt)');
  ok(r.steps.every(function (s) { return !s.pushed; }), 'ingen skub på vejen');
  ok(g.state.moves === 7 && g.undo() && pos(g).x === 1 && g.state.moves === 0, 'hele vejen fortrydes med ét fortryd');
  ok(g.walkTo(3, 1).steps.length === 0, 'mur kan ikke vælges');
  var box = g.state.boxes[0];
  ok(g.walkTo(3, 2).unreachable && g.state.boxes[0] === box, 'kasse længere væk: intet sker');
  g.walkTo(2, 2);
  r = g.walkTo(3, 2);
  ok(r.steps.length === 1 && r.steps[0].pushed && g.state.boxes[0] === g.idx(4, 2), 'kasse ved siden af skubbes');
  g = lvl(['#####', '#@$#', '#. #', '#####']);
  r = g.walkTo(2, 1);
  ok(r.bump && r.bump.bump === 'box' && g.state.moves === 0, 'blokeret kasse ved siden af: intet sker');
})();

// ---------- 6. Fastlåste kasser ----------
section('fastlåste kasser');
(function () {
  var g = lvl(['######', '#@   #', '# $  #', '#   .#', '######']);
  ok(g.stuckBoxes().length === 0, 'fri kasse er ikke fastlåst');
  g = lvl(['######', '#    #', '#$ @ #', '#   .#', '######']);
  ok(g.stuckBoxes().length === 0, 'kasse langs en mur (ikke i hjørne) er ikke fastlåst');
  g = lvl(['######', '#$   #', '# @  #', '#.   #', '######']);
  ok(g.stuckBoxes().length === 1, 'kasse i hjørne uden mål er fastlåst');
  g = lvl(['######', '#*   #', '#@ $ #', '#.  .#', '######']);
  ok(g.stuckBoxes().indexOf(g.idx(1, 1)) < 0, 'kasse i hjørne på et mål er ikke fastlåst');
  g = lvl(['#######', '#     #', '# $$  #', '# $$ @#', '#.... #', '#######']);
  ok(g.stuckBoxes().length === 4, 'fire kasser i en 2 × 2-klump kan ikke flyttes');
  g = lvl(['######', '#$$  #', '#  @ #', '#..  #', '######']);
  ok(g.stuckBoxes().length === 2, 'to kasser side om side langs en mur er fastlåste (2 × 2)');
  g = lvl(['#######', '#@ $  #', '#    .#', '#######']);
  g.move('right'); g.move('right'); g.move('right');
  ok(g.stuckBoxes().length === 1, 'skub ind i hjørne giver fastlåst kasse');
  g.undo();
  ok(g.stuckBoxes().length === 0, 'fortryd fjerner fastlåsningen');
})();

// ---------- 7. Point ----------
section('point');
ok(G.points(0, 3, 3) === 100 && G.points(29, 62, 62) === 680, 'fulde point ved par');
ok(G.points(0, 2, 3) === 100, 'under par giver ikke mere end fulde point');
ok(G.points(0, 6, 3) === 50, 'dobbelt så mange træk giver det halve');
ok(G.points(0, 300, 3) === 25, 'aldrig under en fjerdedel');
ok(G.points(4, 10, 9) < G.points(4, 9, 9) && G.points(4, 11, 9) < G.points(4, 10, 9), 'færre træk giver flere point');

// ---------- 8. Fremskridt, runder og top 10 ----------
section('fremskridt og runder');
(function () {
  var P = G.createProgress(globalThis.localStorage), HS = globalThis.ArkadeHighscores.create('kasser-test', { max: 10 });
  P.reset();
  ok(P.unlocked() === 3 && P.isUnlocked(2) && !P.isUnlocked(3), 'tre baner er åbne fra start');
  ok(P.nextLevel() === 0 && !P.roundActive(), 'start på bane 1, ingen runde');
  var r = P.record(0, 5, G.points(0, 5, 3));
  ok(r.gained === 60 && P.roundTotal() === 60 && P.roundActive(), 'en løst bane starter en runde med point');
  ok(P.unlocked() === 4 && P.nextLevel() === 1, 'næste bane låses op');
  r = P.record(0, 3, G.points(0, 3, 3));
  ok(r.newBest && r.gained === 40 && P.roundTotal() === 100, 'bedre resultat på samme bane: kun forskellen lægges til');
  r = P.record(0, 9, G.points(0, 9, 3));
  ok(!r.newBest && r.gained === 0 && P.roundTotal() === 100 && P.best(0).moves === 3, 'dårligere resultat ændrer intet');
  P.record(1, B[1].par, G.points(1, B[1].par, B[1].par));
  ok(P.roundTotal() === 220 && P.roundLevels() === 2, 'runden samler point fra flere baner');
  // gemt og indlæst igen
  var P2 = G.createProgress(globalThis.localStorage);
  ok(P2.roundTotal() === 220 && P2.best(1).moves === B[1].par && P2.solvedCount() === 2, 'fremskridt og runde gemmes');
  // afslut runde = game over: summen kommer på top 10
  var end = P.endRound();
  ok(end.total === 220 && end.levels === 2 && !P.roundActive() && P.roundTotal() === 0, 'afslut runde nulstiller runden');
  ok(P.solvedCount() === 2 && P.best(0).moves === 3, 'bedste resultater bevares efter runden');
  var h = HS.add('runde', end.total, { levels: end.levels });
  ok(h.rank === 1 && HS.best('runde') === 220 && HS.list('runde')[0].levels === 2, 'runden kommer på top 10');
  for (var i = 0; i < 12; i++) HS.add('runde', 100 + i * 10, { levels: 1 });
  ok(HS.list('runde').length === 10, 'top 10 holder højst 10');
  ok(HS.add('runde', 50, { levels: 1 }).rank === 0, 'for lav score kommer ikke på listen');
  // en ny runde kan give point for den samme bane igen
  r = P.record(0, 3, 100);
  ok(r.gained === 100 && P.roundTotal() === 100, 'ny runde: banen tæller igen');
  // alle baner løst: nextLevel holder sig inden for antallet
  for (var n = 0; n < B.length; n++) P.record(n, B[n].par, G.maxPoints(n));
  ok(P.unlocked() === B.length && P.nextLevel() < B.length, 'alle baner låst op efter alle er løst');
  var maxTotal = 0; for (n = 0; n < B.length; n++) maxTotal += G.maxPoints(n);
  ok(P.roundTotal() === maxTotal, 'en perfekt runde giver ' + maxTotal + ' point');
  P.reset();
})();

console.log('\n' + passed + ' tjek bestået, ' + failed + ' fejlede. Samlet par for alle baner: ' + sumPar + ' træk.');
process.exit(failed ? 1 : 0);
