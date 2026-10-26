/*
 * Labyrinten – logiktest uden browser.  Kør:  node labyrinten/test/test-logik.js
 * Tjekker labyrinterne, ét træk = ét felt, væg uden træk, Rolig-takt, at vagternes viste
 * plan er det, de gør, kollision (også krydsning), sårbarhed og nedtælling, point
 * (vagter, ryddet bane), baneskift, liv, rekorder pr. sværhedsgrad og lange tilfældige spil.
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
function clearItems(s) { for (var i = 0; i < s.items.length; i++) s.items[i] = 0; s.dotsLeft = 0; }
function setItem(s, x, y, v) { s.items[y * s.maze.w + x] = v; s.dotsLeft = s.items.filter(function (q) { return q > 0; }).length; }
function park(s) { s.guards.forEach(function (g) { g.wait = 999; }); }   // vagterne bliver hjemme
function openDirs(r) { return G.ORDER.filter(function (d) { return r.canMove(d); }); }
function wallDir(r) { return G.ORDER.filter(function (d) { return !r.canMove(d); })[0]; }
function key(o) { return o.x + ',' + o.y; }
// Flyt spilleren til et hjørne (1,1), hvor der altid er væg op og til venstre.
function toCorner(s, x, y) { s.player.x = x || 1; s.player.y = y || 1; }
// Retning mod nærmeste prik (BFS), blandt de tilladte retninger.
function towardDot(r, allowed) {
  var s = r.state, m = s.maze, best = null, bd = Infinity;
  allowed.forEach(function (d) {
    var sx = s.player.x + G.DIRS[d].x, sy = s.player.y + G.DIRS[d].y, seen = {}, q = [[sx, sy, 0]];
    seen[sx + ',' + sy] = true;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi];
      if (s.items[c[1] * m.w + c[0]] > 0) { if (c[2] < bd) { bd = c[2]; best = d; } break; }
      G.ORDER.forEach(function (e) {
        var nx = c[0] + G.DIRS[e].x, ny = c[1] + G.DIRS[e].y;
        if (m.open(nx, ny) && !seen[nx + ',' + ny]) { seen[nx + ',' + ny] = true; q.push([nx, ny, c[2] + 1]); }
      });
    }
  });
  return best || allowed[0];
}

// ---------- 1. Labyrinter ----------
section('labyrinter');
ok(M.length >= 3, 'mindst tre labyrinter');
M.forEach(function (def, n) {
  var rows = def.rows, w = rows[0].length, h = rows.length, P = 0, Gc = 0, pel = 0, sym = true;
  ok(w === 15 && h === 13, def.navn + ' er 15 × 13');
  ok(typeof def.navn === 'string' && def.navn.length > 2, 'labyrint ' + n + ' har et navn');
  var open = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '#'; };
  var dead = 0, cells = 0;
  rows.forEach(function (r, y) {
    ok(r.length === w, def.navn + ' række ' + y + ' har forkert længde');
    if (r.replace(/[PG]/g, '.') !== r.replace(/[PG]/g, '.').split('').reverse().join('')) sym = false;
    for (var x = 0; x < w; x++) {
      var c = r[x];
      if (c === 'P') P++; if (c === 'G') Gc++; if (c === 'o') pel++;
      if ((x === 0 || y === 0 || x === w - 1 || y === h - 1)) ok(c === '#', def.navn + ' kant er åben ved ' + x + ',' + y);
      if (c !== '#') {
        cells++;
        var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return open(x + d[0], y + d[1]); }).length;
        if (nb < 2) dead++;
      }
    }
  });
  ok(P === 1 && Gc === 1, def.navn + ' har én start og ét hjem');
  ok(pel === 4, def.navn + ' har fire kraftpiller');
  ok(sym, def.navn + ' er symmetrisk');
  ok(dead === 0, def.navn + ' har ' + dead + ' blindgyder');
  // alt hænger sammen
  var m = G.loadMaze(n), seen = {}, q = [m.start], c2 = 1;
  seen[key(m.start)] = true;
  while (q.length) {
    var p = q.shift();
    G.ORDER.forEach(function (d) {
      var nx = p.x + G.DIRS[d].x, ny = p.y + G.DIRS[d].y;
      if (m.open(nx, ny) && !seen[nx + ',' + ny]) { seen[nx + ',' + ny] = true; c2++; q.push({ x: nx, y: ny }); }
    });
  }
  ok(c2 === cells, def.navn + ': alle felter kan nås');
});

// ---------- 2. Ét træk = ét felt, væg koster intet ----------
section('ét træk = ét felt og væg');
(function () {
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  var x0 = s.player.x, y0 = s.player.y;
  var d = openDirs(r)[0];
  var res = r.move(d);
  ok(!res.bump && res.frames.length === 1, 'et træk giver præcis én ramme');
  ok(Math.abs(s.player.x - x0) + Math.abs(s.player.y - y0) === 1, 'spilleren flytter præcis ét felt');
  ok(s.moves === 1 && s.turn === 1, 'tæller ét træk');
  ok(res.from.player.x === x0 && res.from.player.y === y0, 'from er startfeltet');
  ok(res.paths.length === s.guards.length, 'der er en vej pr. vagt til animationen');
  // gå mod en væg
  toCorner(s);
  var w = wallDir(r);
  ok(!!w, 'der findes en væg ved siden af');
  var before = JSON.stringify(s);
  var b = r.move(w);
  ok(b.bump === true && b.dir === w, 'væg giver bump');
  ok(JSON.stringify(s) === before, 'væg ændrer intet (ingen træk, vagter står stille)');
  var pv = r.preview(w);
  ok(pv && pv.bump === true, 'forhåndsvisning af væg viser bump');
  // gentagne træk i en lang gang: hvert træk ét felt
  for (var i = 0; i < 5; i++) {
    if (s.status !== 'play') break;
    var dd = openDirs(r)[0], px = s.player.x, py = s.player.y;
    r.move(dd);
    ok(Math.abs(s.player.x - px) + Math.abs(s.player.y - py) === 1, 'træk ' + i + ' er ét felt');
  }
})();

// ---------- 3. Takt: Normal hvert træk, Rolig hvert andet ----------
section('vagternes takt');
['normal', 'rolig', 'svaer'].forEach(function (diff) {
  var r = G.createRun({ difficulty: diff }), s = r.state;
  s.guards.forEach(function (g) { g.wait = 0; });
  s.guards.slice(1).forEach(function (g) { g.wait = 999; });
  s.guards[0].type = 'patrulje';
  toCorner(s, 1, 11);
  clearItems(s); setItem(s, 13, 1, 1);   // ingen kraftpiller undervejs (de gør vagterne langsommere)
  // spilleren pendler frem og tilbage langt fra vagterne; tæl vagt 0's skridt
  var steps = 0, moves = 0;
  var d1 = openDirs(r)[0];
  for (var i = 0; i < 8 && s.status === 'play'; i++) {
    var g = s.guards[0], gx = g.x, gy = g.y;
    var d = i % 2 === 0 ? d1 : { up: 'down', down: 'up', left: 'right', right: 'left' }[d1];
    r.move(d); moves++;
    if (s.status !== 'play') break;
    var st = Math.abs(g.x - gx) + Math.abs(g.y - gy);
    ok(st <= 1, diff + ': vagten går højst ét felt pr. træk');
    steps += st;
  }
  if (diff === 'rolig') ok(steps <= Math.ceil(moves / 2), 'rolig: vagten går kun efter hvert andet træk (' + steps + '/' + moves + ')');
  else ok(steps === moves, diff + ': vagten går efter hvert træk (' + steps + '/' + moves + ')');
});

// ---------- 4. Den viste plan er det, der sker ----------
section('vagternes plan = det, de gør');
['rolig', 'normal', 'svaer'].forEach(function (diff) {
  var r = G.createRun({ difficulty: diff }), s = r.state, checked = 0, seed = 7;
  for (var i = 0; i < 3000 && checked < 400; i++) {
    if (s.status === 'caught') { r.continueAfterCatch(); continue; }
    if (s.status === 'cleared') { r.nextLevel(); continue; }
    if (s.status === 'over') { r = G.createRun({ difficulty: diff }); s = r.state; continue; }
    var plans = s.guards.map(function (g) { return r.guardPlan(g); });
    var dirs = openDirs(r); seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var safe = dirs.filter(function (d) { return r.preview(d).result !== 'caught'; });
    if (safe.length) dirs = safe;
    var res = r.move(dirs[seed % dirs.length]);
    s.guards.forEach(function (g, k) {
      if (g.mode === 'eyes' && !plans[k]) return;
      var exp = plans[k] ? plans[k].path[plans[k].path.length - 1] : res.from.guards[k];
      if (res.events.some(function (e) { return e.type === 'guard' && e.id === g.id; })) return;
      ok(g.x === exp.x && g.y === exp.y, diff + ' træk ' + i + ': vagt ' + k + ' fulgte ikke sin plan');
      checked++;
    });
  }
  ok(checked > 100, diff + ': mange planer tjekket (' + checked + ')');
});

// ---------- 5. Kollision ----------
section('kollision');
(function () {
  // samme felt: vagten står to felter væk og går ind i feltet, spilleren går til
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  park(s);
  var d = openDirs(r)[0], D = G.DIRS[d];
  var tx = s.player.x + D.x, ty = s.player.y + D.y;
  var g = s.guards[0]; g.wait = 0; g.type = 'jaeger';
  // læg vagten på feltet bag målet, hvis det er åbent; ellers samme felt som målet
  if (s.maze.open(tx + D.x, ty + D.y)) { g.x = tx + D.x; g.y = ty + D.y; g.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[d]; }
  else { g.x = tx; g.y = ty; }
  var plan = r.guardPlan(g);
  var pv = r.preview(d);
  var res = r.move(d);
  if (plan && plan.path[0].x === tx && plan.path[0].y === ty || (g.x === tx && g.y === ty)) {
    ok(res.result === 'caught', 'samme felt fanger');
    ok(pv.result === 'caught' && pv.caughtAt, 'forhåndsvisningen viste fangsten');
    ok(s.lives === 2, 'mister et liv');
  } else ok(true, 'opsætning sprang over');
})();
(function () {
  // krydsning: vagten står i målfeltet og går mod spilleren
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  park(s);
  var d = openDirs(r)[0], D = G.DIRS[d];
  var g = s.guards[0]; g.wait = 0; g.type = 'jaeger';
  g.x = s.player.x + D.x; g.y = s.player.y + D.y;
  g.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[d];
  var plan = r.guardPlan(g);
  ok(plan && plan.path[0].x === s.player.x && plan.path[0].y === s.player.y, 'jægeren planlægger at gå mod spilleren');
  var res = r.move(d);
  ok(res.result === 'caught', 'krydsning fanger');
})();

// ---------- 6. Kraftpille, sårbarhed og nedtælling ----------
section('sårbarhed');
[['normal', 12], ['rolig', 20], ['svaer', 8]].forEach(function (t) {
  var r = G.createRun({ difficulty: t[0] }), s = r.state;
  park(s);
  var d = openDirs(r)[0], D = G.DIRS[d];
  clearItems(s); setItem(s, s.player.x + D.x, s.player.y + D.y, 2); setItem(s, 1, 1, 1);
  if (s.player.x + D.x === 1 && s.player.y + D.y === 1) setItem(s, 13, 1, 1);
  var res = r.move(d);
  ok(res.events.some(function (e) { return e.type === 'pellet'; }), t[0] + ': kraftpille spist');
  ok(s.fright === t[1], t[0] + ': sårbar i ' + t[1] + ' træk (fik ' + s.fright + ')');
  ok(s.guards.every(function (g) { return g.scared; }), t[0] + ': alle vagter er sårbare');
  ok(s.score === 50, t[0] + ': kraftpille giver 50');
  var back = { up: 'down', down: 'up', left: 'right', right: 'left' }[d], n = 0, ended = false;
  while (s.fright > 0 && n < 40) {
    var f = s.fright, rr = r.move(n % 2 === 0 ? back : d); n++;
    ok(s.fright === f - 1, t[0] + ': tæller ét ned pr. træk');
    if (s.fright === 0) ended = rr.events.some(function (e) { return e.type === 'frightEnd'; });
  }
  ok(n === t[1] && ended, t[0] + ': sårbarheden slutter efter præcis ' + t[1] + ' træk');
  ok(s.guards.every(function (g) { return !g.scared; }), t[0] + ': ingen sårbare bagefter');
  // væg tæller ikke ned
  setItem(s, s.player.x, s.player.y, 0);
});
ok(G.DIFFICULTIES.rolig.fright(1) > G.DIFFICULTIES.normal.fright(1) && G.DIFFICULTIES.normal.fright(1) > G.DIFFICULTIES.svaer.fright(1), 'Rolig længere, Svær kortere');
(function () {
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  s.fright = 5; s.guards.forEach(function (g) { g.scared = true; });
  toCorner(s);
  var w = wallDir(r); r.move(w);
  ok(s.fright === 5, 'gå mod en væg tæller ikke sårbarheden ned');
})();

// ---------- 7. Vagter giver 200/400/800/1600, øjne løber hjem ----------
section('fangede vagter');
(function () {
  var r = G.createRun({ difficulty: 'svaer' }), s = r.state;
  ok(s.guards.length === 4, 'svær har fire vagter');
  park(s);
  var d = openDirs(r)[0], D = G.DIRS[d];
  var tx = s.player.x + D.x, ty = s.player.y + D.y;
  s.fright = 10; s.guards.forEach(function (g) { g.scared = true; g.x = tx; g.y = ty; });
  setItem(s, 1, 1, 1);
  var res = r.move(d);
  var pts = res.events.filter(function (e) { return e.type === 'guard'; }).map(function (e) { return e.points; });
  ok(JSON.stringify(pts) === '[200,400,800,1600]', 'kæden giver 200, 400, 800, 1600 (fik ' + pts + ')');
  ok(s.guards.every(function (g) { return g.mode === 'eyes'; }), 'fangede vagter bliver til øjne');
  ok(res.result === 'ok' && s.lives === 3, 'øjne fanger ikke');
  // øjne løber hjem (to felter pr. træk) og bliver vagter igen
  var back = { up: 'down', down: 'up', left: 'right', right: 'left' }[d], n = 0;
  while (s.guards.some(function (g) { return g.mode === 'eyes'; }) && n < 40 && s.status === 'play') { r.move(n % 2 ? d : back); n++; }
  ok(s.guards.every(function (g) { return g.mode === 'normal'; }), 'øjnene nåede hjem (' + n + ' træk)');
})();

// ---------- 8. Ryddet bane, point og sværere baner ----------
section('baner');
(function () {
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  park(s);
  var d = openDirs(r)[0], D = G.DIRS[d];
  clearItems(s); setItem(s, s.player.x + D.x, s.player.y + D.y, 1);
  var res = r.move(d);
  ok(res.result === 'cleared' && s.status === 'cleared', 'sidste prik rydder banen');
  var ev = res.events.filter(function (e) { return e.type === 'cleared'; })[0];
  ok(ev && ev.bonus === 250, 'bane 1 giver 250 point');
  ok(s.score === 10 + 250, 'point = prik + banebonus');
  ok(r.nextLevel() && s.level === 2 && s.cleared === 1 && s.status === 'play', 'næste bane');
  ok(s.maze.index === 1, 'næste labyrint');
  ok(G.POINTS.level(3) === 750, 'bane 3 giver 750');
  ok(s.guards.length === 4, 'normal bane 2 har fire vagter');
  ok(s.fright === 0 && s.dotsLeft === s.dotsTotal, 'frisk bane');
})();
['rolig', 'normal', 'svaer'].forEach(function (diff) {
  var D = G.DIFFICULTIES[diff], prevG = 0, prevF = 99, prevSmart = false, mono = true;
  for (var L = 1; L <= 10; L++) {
    if (D.guards(L) < prevG || D.fright(L) > prevF || (prevSmart && !D.smart(L))) mono = false;
    prevG = D.guards(L); prevF = D.fright(L); prevSmart = D.smart(L);
  }
  ok(mono, diff + ': banerne bliver gradvist sværere');
  ok(D.guards(10) > D.guards(1) || D.smart(10) && !D.smart(1) || D.fright(10) < D.fright(1), diff + ': bane 10 er sværere end bane 1');
});

// ---------- 9. Liv ----------
section('liv');
(function () {
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  var dots = s.dotsLeft;
  for (var life = 3; life >= 1; life--) {
    var g = s.guards[0], d = openDirs(r)[0], D = G.DIRS[d];
    park(s); g.wait = 0; g.x = s.player.x + D.x; g.y = s.player.y + D.y; g.scared = false; g.mode = 'normal';
    g.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[d];
    var res = r.move(d);
    ok(res.result === (life > 1 ? 'caught' : 'over'), 'liv ' + life + ': ' + res.result);
    if (life > 1) {
      var left = s.dotsLeft;
      ok(r.continueAfterCatch() && s.status === 'play', 'fortsæt efter fangst');
      ok(s.player.x === s.maze.start.x && s.player.y === s.maze.start.y, 'spilleren starter forfra');
      ok(s.dotsLeft === left, 'prikkerne bliver liggende');
    }
  }
  ok(s.status === 'over' && s.lives === 0, 'game over efter tre liv');
  ok(r.move('left').ignored, 'ingen træk efter game over');
  ok(r.preview('left') === null, 'ingen forhåndsvisning efter game over');
})();

// ---------- 10. Forhåndsvisning ændrer intet ----------
section('forhåndsvisning');
(function () {
  var r = G.createRun({ difficulty: 'normal' }), s = r.state;
  for (var i = 0; i < 30 && s.status === 'play'; i++) {
    var before = JSON.stringify(s);
    G.ORDER.forEach(function (d) { r.preview(d); });
    ok(JSON.stringify(s) === before, 'preview ændrede tilstanden');
    var d = openDirs(r)[i % openDirs(r).length];
    var pv = r.preview(d), res = r.move(d);
    ok(pv.result === res.result, 'preview forudsagde resultatet');
    ok(pv.path[0].x === s.player.x && pv.path[0].y === s.player.y, 'preview viste slutfeltet');
  }
})();

// ---------- 11. Rekorder pr. sværhedsgrad ----------
section('rekorder');
(function () {
  var hs = globalThis.ArkadeHighscores.create('labyrinten', { max: 10 });
  for (var i = 0; i < 14; i++) hs.add('normal', 100 * i, { levels: i % 3 });
  hs.add('rolig', 999, { levels: 1 });
  ok(hs.list('normal').length === 10, 'top 10 pr. sværhedsgrad');
  ok(hs.list('normal')[0].score === 1300, 'bedste først');
  ok(hs.best('rolig') === 999 && hs.list('svaer').length === 0, 'kategorierne er adskilt');
  ok(Object.keys(store).some(function (k) { return /labyrinten/.test(k); }), 'gemt i localStorage');
})();

// ---------- 12. Lange tilfældige spil ----------
section('lange tilfældige spil');
['rolig', 'normal', 'svaer'].forEach(function (diff) {
  var seed = 12345, maxLevel = 1, games = 0, moves = 0, bad = 0;
  for (var gi = 0; gi < 40; gi++) {
    var r = G.createRun({ difficulty: diff }), s = r.state;
    for (var i = 0; i < 4000; i++) {
      if (s.status === 'caught') { r.continueAfterCatch(); continue; }
      if (s.status === 'cleared') { r.nextLevel(); continue; }
      if (s.status === 'over') break;
      // prøv at undgå fangst, hvis muligt (som en forsigtig spiller)
      var dirs = openDirs(r), safe = dirs.filter(function (d) { return r.preview(d).result !== 'caught'; });
      var pick = safe.length ? safe : dirs;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var px = s.player.x, py = s.player.y;
      // mest mod nærmeste prik, af og til tilfældigt
      r.move(seed % 5 ? towardDot(r, pick) : pick[seed % pick.length]); moves++;
      if (Math.abs(s.player.x - px) + Math.abs(s.player.y - py) !== 1 && s.status === 'play') bad++;
      s.guards.forEach(function (g) { if (!s.maze.open(g.x, g.y)) bad++; });
      if (s.dotsLeft < 0 || s.fright < 0) bad++;
    }
    maxLevel = Math.max(maxLevel, s.level); games++;
  }
  ok(bad === 0, diff + ': ingen ulovlige tilstande (' + bad + ')');
  ok(maxLevel >= 2, diff + ': en forsigtig spiller kan rydde baner (højeste ' + maxLevel + ')');
  console.log('    ' + diff + ': ' + games + ' spil, ' + moves + ' træk, højeste bane ' + maxLevel);
});

console.log('\n' + passed + ' tjek bestået, ' + failed + ' fejlede');
process.exit(failed ? 1 : 0);
