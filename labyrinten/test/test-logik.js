/*
 * Labyrinten – logiktest uden browser.  Kør:  node labyrinten/test/test-logik.js
 * Tjekker labyrinterne, glidning, spøgelser, kollision (også når de krydser
 * hinanden), kraftpiller, banskift, liv og rekorder (med arkade/highscores.js).
 */
'use strict';
var path = require('path');
var store = {};
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }
};
require(path.join(__dirname, '../js/mazes.js'));
require(path.join(__dirname, '../js/game.js'));
require(path.join(__dirname, '../../arkade/highscores.js'));
var G = globalThis.LabyrintenGame, M = globalThis.LabyrintenMazes;

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('  FEJL: ' + msg); } }
function section(name) { console.log('- ' + name); }

// Lille hjælper: en kørsel med en håndbygget tilstand
function runWith(size, diff, mut) {
  var r = G.createRun({ size: size, difficulty: diff });
  if (mut) mut(r.state);
  return r;
}
function clearItems(s) { for (var i = 0; i < s.items.length; i++) s.items[i] = 0; }

// ---------- 1. Labyrinter ----------
section('labyrinter');
Object.keys(M).forEach(function (size) {
  M[size].forEach(function (def, n) {
    var rows = def.rows, w = rows[0].length, h = rows.length, P = 0, Gc = 0, o = 0;
    var open = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '#'; };
    var dead = 0, sym = true;
    rows.forEach(function (r, y) {
      ok(r.length === w, size + n + ' række ' + y + ' har forkert længde');
      if (r !== r.split('').reverse().join('')) sym = false;
      for (var x = 0; x < w; x++) {
        var c = r[x];
        if (c === 'P') P++; if (c === 'G') Gc++; if (c === 'o') o++;
        if (c !== '#') {
          ok(x > 0 && y > 0 && x < w - 1 && y < h - 1, size + n + ' åben kant ved ' + x + ',' + y);
          var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return open(x + d[0], y + d[1]); }).length;
          if (nb < 2) dead++;
        }
      }
    });
    ok(P === 1 && Gc === 1, size + n + ' skal have præcis ét P og ét G');
    ok(o === 4, size + n + ' skal have 4 kraftpiller');
    ok(dead === 0, size + n + ' har blindgyder');
    ok(sym, size + n + ' er ikke symmetrisk');
    var maze = G.loadMaze(size, n);
    ok(maze.w === w && maze.h === h, size + n + ' indlæses');
  });
});

// ---------- 2. Glidning ----------
section('glidning');
(function () {
  var r = runWith('mellem', 'normal', function (s) { s.ghosts.forEach(function (g) { g.wait = 99; }); });
  var s = r.state;
  // ingen vej ind i væggen
  var blocked = G.ORDER.filter(function (d) { return !r.canMove(d); });
  ok(blocked.length > 0, 'startfeltet har mindst én væg');
  ok(r.move(blocked[0]).ignored === true, 'træk ind i væg ignoreres');
  // hver glidning stopper ved kryds, sving eller væg, og alle mellemfelter er lige gange
  for (var k = 0; k < 40; k++) {
    var dirs = G.ORDER.filter(function (d) { return r.canMove(d); });
    var dir = dirs[k % dirs.length];
    var res = r.move(dir);
    if (res.result !== 'ok') break;
    var last = res.frames[res.frames.length - 1].player;
    var D = G.DIRS[dir];
    var fwd = s.maze.open(last.x + D.x, last.y + D.y);
    var sides = D.x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    var side = sides.some(function (q) { return s.maze.open(last.x + q[0], last.y + q[1]); });
    var pellet = res.events.some(function (e) { return e.type === 'pellet'; });
    ok(!fwd || side || pellet, 'glidning stopper kun ved kryds/sving/væg/kraftpille (træk ' + k + ')');
    res.frames.slice(0, -1).forEach(function (f) {
      var midSide = sides.some(function (q) { return s.maze.open(f.player.x + q[0], f.player.y + q[1]); });
      ok(!midSide, 'glidning springer ikke et kryds over');
    });
    res.frames.forEach(function (f) { ok(s.maze.open(f.player.x, f.player.y), 'spilleren står aldrig i en væg'); });
  }
})();

// ---------- 3. Prikker og point ----------
section('prikker og point');
(function () {
  var r = runWith('lille', 'normal', function (s) { s.ghosts.forEach(function (g) { g.wait = 99; }); });
  var s = r.state, before = s.dotsLeft;
  var res = r.move('left');
  var dots = res.events.filter(function (e) { return e.type === 'dot'; }).length;
  ok(dots >= 1 && s.score === dots * 10, 'prik giver 10 point');
  ok(s.dotsLeft === before - dots, 'prikker tælles ned');
})();

// ---------- 4. Spøgelser: bevægelse og hastighed ----------
section('spøgelser');
(function () {
  ['rolig', 'normal', 'svaer'].forEach(function (d) {
    var r = runWith('stor', d, function (s) { s.ghosts.forEach(function (g) { g.wait = 0; }); });
    var s = r.state;
    var start = s.ghosts.map(function (g) { return { x: g.x, y: g.y }; });
    var res = r.move(G.ORDER.filter(function (q) { return r.canMove(q); })[0]);
    var n = res.frames.length;
    s.ghosts.forEach(function (g, i) {
      var md = Math.abs(g.x - start[i].x) + Math.abs(g.y - start[i].y);
      var max = d === 'rolig' ? Math.ceil(n / 2) : n;
      ok(md <= max, d + ': spøgelse ' + g.type + ' flytter højst ' + max + ' felter (flyttede ' + md + ')');
      ok(s.maze.open(g.x, g.y), d + ': spøgelse står aldrig i en væg');
    });
  });
  // antal spøgelser pr. sværhedsgrad
  ok(G.createRun({ difficulty: 'rolig' }).state.ghosts.length === 2, 'rolig: 2 spøgelser på bane 1');
  ok(G.createRun({ difficulty: 'normal' }).state.ghosts.length === 3, 'normal: 3 spøgelser på bane 1');
  ok(G.createRun({ difficulty: 'svaer' }).state.ghosts.length === 4, 'svær: 4 spøgelser på bane 1');
  // forudsigelighed: samme træk giver samme resultat
  var a = G.createRun({ size: 'mellem', difficulty: 'normal' }), b = G.createRun({ size: 'mellem', difficulty: 'normal' });
  var seq = [];
  for (var k = 0; k < 15; k++) {
    var dirs = G.ORDER.filter(function (q) { return a.canMove(q); });
    if (!dirs.length) break;
    var dir = dirs[(k * 7) % dirs.length]; seq.push(dir);
    var ra = a.move(dir), rb = b.move(dir);
    if (ra.result === 'caught') { a.continueAfterCatch(); b.continueAfterCatch(); }
    if (ra.result !== 'ok' && ra.result !== 'caught') break;
  }
  ok(JSON.stringify(a.state.ghosts) === JSON.stringify(b.state.ghosts) && a.state.score === b.state.score, 'spillet er helt forudsigeligt');
  // forhåndsvisning ændrer intet og passer med det rigtige træk
  var c = G.createRun({ size: 'mellem', difficulty: 'normal' });
  var dir0 = G.ORDER.filter(function (q) { return c.canMove(q); })[0];
  var snap = JSON.stringify([c.state.player, c.state.ghosts, c.state.score]);
  var pv = c.preview(dir0);
  ok(JSON.stringify([c.state.player, c.state.ghosts, c.state.score]) === snap, 'forhåndsvisning ændrer ikke spillet');
  var real = c.move(dir0);
  var end = real.frames[real.frames.length - 1].player;
  ok(pv.path.length === real.frames.length && pv.path[pv.path.length - 1].x === end.x && pv.path[pv.path.length - 1].y === end.y, 'forhåndsvisning viser det rigtige slutfelt');
  ok(JSON.stringify(pv.ghosts.map(function (g) { return [g.x, g.y]; })) === JSON.stringify(c.state.ghosts.map(function (g) { return [g.x, g.y]; })), 'forhåndsvisning viser spøgelsernes rigtige felter');
})();

// ---------- 5. Kollision ----------
section('kollision');
(function () {
  // a) spøgelset står i feltet, spilleren går ind i
  var r = runWith('mellem', 'normal', function (s) {
    s.ghosts.forEach(function (g) { g.wait = 99; g.x = s.maze.home.x; g.y = s.maze.home.y; });
    var g = s.ghosts[0]; g.wait = 0; g.x = s.player.x - 1; g.y = s.player.y; g.dir = 'right';
  });
  ok(r.canMove('left'), 'testopsætning: kan gå til venstre');
  var res = r.move('left');
  ok(res.result === 'caught' && r.state.lives === 2, 'gå ind i spøgelse koster et liv');
  ok(res.frames.length === 1, 'glidningen stopper, når man bliver fanget');

  // b) de krydser hinanden i samme træk (bytter felter)
  r = runWith('mellem', 'normal', function (s) {
    s.ghosts.forEach(function (g) { g.wait = 99; g.x = s.maze.home.x; g.y = s.maze.home.y; });
    var g = s.ghosts[0]; g.wait = 0; g.x = s.player.x - 2; g.y = s.player.y; g.dir = 'right';
  });
  // spilleren går til venstre (til x-1), spøgelset kommer mod højre (til x-1) -> samme felt
  res = r.move('left');
  ok(res.result === 'caught', 'spøgelse og spiller i samme felt efter samme skridt');

  // c) rent krydsning: spøgelse og spiller bytter plads
  r = runWith('mellem', 'normal', function (s) {
    s.ghosts.forEach(function (g) { g.wait = 99; g.x = s.maze.home.x; g.y = s.maze.home.y; });
  });
  var s = r.state;
  // find et sted, hvor spilleren og spøgelset kan bytte: spøgelset står foran og vil gå mod spilleren,
  // men vi lader spilleren "gå igennem" ved først at flytte spøgelset ind i hans felt i ghost-skridtet.
  var g0 = s.ghosts[0]; g0.wait = 0;
  g0.x = s.player.x - 1; g0.y = s.player.y; g0.dir = 'right';
  g0.scared = true; s.fright = 5;   // bange: så skal den spises (ikke fange)
  res = r.move('left');
  ok(res.events.some(function (e) { return e.type === 'ghost' && e.points === 200; }), 'bange spøgelse spises for 200 point');
  ok(s.ghosts[0].mode === 'eyes', 'spist spøgelse bliver til øjne, der går hjem');
  // øjnene når hjem og bliver til et almindeligt spøgelse igen
  for (var k = 0; k < 30 && s.ghosts[0].mode === 'eyes'; k++) {
    var dirs = G.ORDER.filter(function (q) { return r.canMove(q); });
    var rr = r.move(dirs[k % dirs.length]);
    if (rr.result !== 'ok') break;
  }
  ok(s.ghosts[0].mode === 'normal', 'øjnene vender hjem og bliver til et spøgelse igen');

  // d) krydsning direkte via motoren: stil dem op, så de bytter felt
  r = runWith('stor', 'normal', function (st) {
    st.ghosts.forEach(function (g) { g.wait = 99; g.x = st.maze.home.x; g.y = st.maze.home.y; });
  });
  s = r.state;
  // find en lang vandret gang, sæt spiller og spøgelse ved siden af hinanden med front mod hinanden
  var found = false;
  for (var y = 1; y < s.maze.h - 1 && !found; y++) for (var x = 2; x < s.maze.w - 2 && !found; x++) {
    if (s.maze.open(x, y) && s.maze.open(x + 1, y) && !s.maze.open(x, y - 1) && !s.maze.open(x, y + 1) &&
        !s.maze.open(x + 1, y - 1) && !s.maze.open(x + 1, y + 1)) {
      s.player.x = x; s.player.y = y;
      var gg = s.ghosts[0]; gg.wait = 0; gg.x = x + 1; gg.y = y; gg.dir = 'left'; gg.type = 'jager';
      found = true;
    }
  }
  ok(found, 'testopsætning: fandt en vandret gang');
  res = r.move('right');
  ok(res.result === 'caught', 'kollision, når spiller og spøgelse bytter felt');
})();

// ---------- 6. Kraftpiller ----------
section('kraftpiller');
(function () {
  ['rolig', 'normal', 'svaer'].forEach(function (d) {
    var r = runWith('lille', d, function (s) {
      s.ghosts.forEach(function (g) { g.wait = 99; });
      // læg en kraftpille lige ved siden af spilleren
      s.items[s.player.y * s.maze.w + s.player.x - 1] = 2;
    });
    var s = r.state, sc = s.score;
    var res = r.move('left');
    ok(res.events.some(function (e) { return e.type === 'pellet'; }), d + ': kraftpille spises');
    ok(s.score - sc === 50, d + ': kraftpille giver 50 point');
    ok(res.frames.length === 1, d + ': glidningen stopper ved kraftpillen');
    var expected = G.DIFFICULTIES[d].fright(1);
    ok(s.fright === expected, d + ': spøgelserne er bange i ' + expected + ' felter (fik ' + s.fright + ')');
    ok(s.ghosts.every(function (g) { return g.scared; }), d + ': alle spøgelser er bange');
  });
  ok(G.DIFFICULTIES.rolig.fright(1) > G.DIFFICULTIES.normal.fright(1) && G.DIFFICULTIES.normal.fright(1) > G.DIFFICULTIES.svaer.fright(1), 'kortere sårbarhed jo sværere');
  ok(G.DIFFICULTIES.normal.fright(50) >= 10 && G.DIFFICULTIES.svaer.fright(50) >= 6, 'bange-tiden har et loft nedad');
  // tælleren tæller ned og slutter
  var r = runWith('lille', 'normal', function (s) { s.ghosts.forEach(function (g) { g.wait = 99; g.scared = true; }); s.fright = 2; });
  var s = r.state, total = 0, ended = false;
  for (var k = 0; k < 10 && !ended; k++) {
    var dirs = G.ORDER.filter(function (q) { return r.canMove(q); });
    var res = r.move(dirs[k % dirs.length]);
    total += res.frames.length;
    ended = res.events.some(function (e) { return e.type === 'frightEnd'; });
  }
  ok(ended && s.fright === 0 && s.ghosts.every(function (g) { return !g.scared; }), 'bange-tiden slutter efter det viste antal felter');
  // 200/400/800/1600 i træk
  r = runWith('stor', 'svaer');   // svær har fire spøgelser fra bane 1
  s = r.state;
  var pts = [];
  s.ghosts.forEach(function (g) { g.wait = 99; g.scared = true; g.x = s.player.x; g.y = s.player.y; });
  s.fright = 10;
  // flyt alle ind i det felt, spilleren går hen til
  var dir = G.ORDER.filter(function (q) { return r.canMove(q); })[0];
  s.ghosts.forEach(function (g) { g.x = s.player.x + G.DIRS[dir].x; g.y = s.player.y + G.DIRS[dir].y; });
  var res2 = r.move(dir);
  res2.events.forEach(function (e) { if (e.type === 'ghost') pts.push(e.points); });
  ok(JSON.stringify(pts) === '[200,400,800,1600]', 'spiste spøgelser giver 200, 400, 800 og 1600 (fik ' + pts.join(',') + ')');
})();

// ---------- 7. Banskift ----------
section('banskift');
(function () {
  var r = runWith('lille', 'normal', function (s) {
    s.ghosts.forEach(function (g) { g.wait = 99; });
    clearItems(s);
    s.items[s.player.y * s.maze.w + s.player.x - 1] = 1;
    s.dotsLeft = 1;
  });
  var s = r.state;
  var res = r.move('left');
  ok(res.result === 'cleared' && s.status === 'cleared', 'sidste prik rydder banen');
  ok(r.move('right').ignored, 'ingen træk, mens banen er ryddet');
  var firstMaze = s.maze.name;
  ok(r.nextLevel() && s.level === 2 && s.cleared === 1, 'næste bane');
  ok(s.maze.name !== firstMaze, 'ny labyrint på næste bane');
  ok(s.dotsLeft === s.dotsTotal && s.dotsLeft > 20, 'ny bane er fuld af prikker');
  ok(s.lives === 3 && s.score === 10, 'liv og point følger med');
  // labyrinterne går på omgang
  var names = [];
  for (var lv = 0; lv < 4; lv++) names.push(G.loadMaze('mellem', lv).name);
  ok(names[0] === names[3] && names[0] !== names[1], 'labyrinterne går på omgang');
  // flere spøgelser og kortere ventetid med loft
  ok(G.DIFFICULTIES.normal.ghosts(2) === 4 && G.DIFFICULTIES.normal.ghosts(20) === 4, 'normal: 4 spøgelser fra bane 2, loft 4');
  ok(G.DIFFICULTIES.rolig.ghosts(3) === 3 && G.DIFFICULTIES.rolig.ghosts(20) === 3, 'rolig: 3 spøgelser fra bane 3, loft 3');
})();

// ---------- 8. Liv ----------
section('liv');
(function () {
  var r = G.createRun({ size: 'mellem', difficulty: 'normal' });
  var s = r.state;
  ok(s.lives === 3 && s.maxLives === 3, 'altid tre liv');
  var catches = 0;
  for (var round = 0; round < 3; round++) {
    s.ghosts.forEach(function (g) { g.wait = 99; g.x = s.maze.home.x; g.y = s.maze.home.y; });
    var g = s.ghosts[0]; g.wait = 0; g.scared = false; g.mode = 'normal';
    var dir = G.ORDER.filter(function (q) { return r.canMove(q); })[0];
    g.x = s.player.x + G.DIRS[dir].x; g.y = s.player.y + G.DIRS[dir].y;
    var res = r.move(dir);
    var dotsBefore = s.dotsLeft;
    ok(res.result === (round < 2 ? 'caught' : 'over'), 'runde ' + round + ': ' + res.result);
    catches++;
    if (round < 2) {
      ok(r.move(dir).ignored, 'ingen træk, før man vælger Fortsæt');
      r.continueAfterCatch();
      ok(s.player.x === s.maze.start.x && s.player.y === s.maze.start.y, 'spilleren stiller sig på start igen');
      ok(s.ghosts.every(function (q, i) { return q.x === s.maze.ghostStarts[i].x && q.y === s.maze.ghostStarts[i].y; }), 'spøgelserne stiller sig hjem igen');
      ok(s.dotsLeft === dotsBefore, 'prikkerne bliver liggende');
      ok(s.fright === 0, 'ingen bange-tid efter et mistet liv');
    }
  }
  ok(s.lives === 0 && s.status === 'over', 'spillet slutter efter tre liv');
  ok(!r.continueAfterCatch(), 'kan ikke fortsætte uden liv');
})();

// ---------- 9. Rekorder ----------
section('rekorder');
(function () {
  var hs = globalThis.ArkadeHighscores.create('labyrinten', { max: 10 });
  hs.clear();
  for (var i = 1; i <= 12; i++) hs.add('normal-mellem', i * 100, { levels: i % 4 });
  var l = hs.list('normal-mellem');
  ok(l.length === 10 && l[0].score === 1200 && l[9].score === 300, 'top 10, højeste først');
  ok(typeof l[0].levels === 'number' && l[0].date, 'gemmer antal baner og dato');
  hs.add('svaer-mellem', 50, { levels: 0 });
  ok(hs.list('svaer-mellem').length === 1 && hs.best('rolig-mellem') === 0, 'separat liste pr. sværhedsgrad og størrelse');
  ok(store['hojtArkade.labyrinten.rekorder'], 'gemmes i localStorage under hojtArkade.labyrinten.rekorder');
})();

// ---------- 10. Lange tilfældige spil (robusthed) ----------
section('lange spil');
(function () {
  var seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var maxLevel = 0, total = 0;
  ['rolig', 'normal', 'svaer'].forEach(function (d) {
    ['lille', 'mellem', 'stor'].forEach(function (size) {
      for (var game = 0; game < 5; game++) {
        var r = G.createRun({ size: size, difficulty: d });
        for (var k = 0; k < 3000; k++) {
          var s = r.state;
          if (s.status === 'caught') { r.continueAfterCatch(); continue; }
          if (s.status === 'cleared') { r.nextLevel(); continue; }
          if (s.status === 'over') break;
          var dirs = G.ORDER.filter(function (q) { return r.canMove(q); });
          var res = r.move(dirs[Math.floor(rnd() * dirs.length)]);
          total++;
          res.frames.forEach(function (f) {
            if (!s.maze.open(f.player.x, f.player.y)) throw new Error('spiller i væg');
            f.ghosts.forEach(function (g) { if (!s.maze.open(g.x, g.y)) throw new Error('spøgelse i væg'); });
          });
        }
        maxLevel = Math.max(maxLevel, r.state.level);
      }
    });
  });
  ok(total > 1000, 'mange træk kørt (' + total + ')');
  console.log('  (' + total + ' tilfældige træk, højeste bane nået: ' + maxLevel + ')');
})();

console.log('\n' + passed + ' tjek bestået, ' + failed + ' fejlede');
process.exit(failed ? 1 : 0);
