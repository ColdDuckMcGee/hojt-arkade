/*
 * Kasser – hjælpeværktøj til at finde kandidater til baner (ikke en del af spillet).
 *   node kasser/vaerktoej/generer-baner.js [antal-forsøg] [frø]
 * Laver tilfældige små rum (højst 8 × 8 felter med ydermur), placerer mål og trækker kasserne
 * baglæns væk fra målene (omvendt bredde-først søgning). Den stilling, der kræver flest skub,
 * vælges. Løseren finder derefter den korteste løsning i træk (par). Kandidaterne skrives ud
 * som JSON; de endelige baner er udvalgt og tilrettet i hånden i js/baner.js.
 */
'use strict';
var S = require('../test/solver.js');
var N = +(process.argv[2] || 400), seed = +(process.argv[3] || 1);
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
var D = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function room(W, H, wallFrac) {
  var g = [];
  for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : ' '); }
  var inner = (W - 2) * (H - 2), k = Math.round(inner * wallFrac);
  // hak i hjørnerne giver mindre firkantede rum
  if (rnd() < 0.6) { var cx = rnd() < 0.5 ? 1 : W - 2, cy = rnd() < 0.5 ? 1 : H - 2; g[cy][cx] = '#'; if (rnd() < 0.5) g[cy][cx === 1 ? 2 : W - 3] = '#'; }
  for (var i = 0; i < k; i++) g[ri(1, H - 2)][ri(1, W - 2)] = '#';
  return g;
}
function floorCells(g) { var c = []; g.forEach(function (r, y) { r.forEach(function (v, x) { if (v !== '#') c.push([x, y]); }); }); return c; }
function connected(g) {
  var c = floorCells(g); if (c.length < 6) return false;
  var seen = {}, q = [c[0]]; seen[c[0]] = 1; var n = 1;
  while (q.length) { var p = q.pop(); D.forEach(function (d) { var x = p[0] + d[0], y = p[1] + d[1]; if (g[y][x] !== '#' && !seen[[x, y]]) { seen[[x, y]] = 1; n++; q.push([x, y]); } }); }
  return n === c.length;
}

function reverseFarthest(g, goals) {
  var H = g.length, W = g[0].length, wall = function (i) { return g[(i / W) | 0][i % W] === '#'; };
  function region(p, boxes) {
    var seen = new Set([p]), q = [p], m = p;
    while (q.length) { var c = q.pop(); if (c < m) m = c; for (var d = 0; d < 4; d++) { var n = c + D[d][0] + D[d][1] * W; if (!wall(n) && boxes.indexOf(n) < 0 && !seen.has(n)) { seen.add(n); q.push(n); } } }
    return { min: m, cells: seen };
  }
  var boxes0 = goals.slice().sort(function (a, b) { return a - b; });
  var seen = new Map(), q = [];
  floorCells(g).forEach(function (c) {
    var i = c[1] * W + c[0]; if (boxes0.indexOf(i) >= 0) return;
    var r = region(i, boxes0), k = r.min + ':' + boxes0.join(',');
    if (!seen.has(k)) { seen.set(k, 0); q.push({ p: r.min, b: boxes0, d: 0 }); }
  });
  var best = null;
  for (var qi = 0; qi < q.length; qi++) {
    var s = q[qi], r = region(s.p, s.b);
    if (s.d > 0 && (!best || s.d > best.d)) best = s;
    for (var bi = 0; bi < s.b.length; bi++) for (var d = 0; d < 4; d++) {
      var b = s.b[bi], dx = D[d][0] + D[d][1] * W, pp = b - dx, to = b - 2 * dx;
      if (!r.cells.has(pp) || wall(to) || s.b.indexOf(to) >= 0) continue;
      var nb = s.b.slice(); nb[bi] = pp; nb.sort(function (a, c) { return a - c; });
      var nr = region(to, nb), k = nr.min + ':' + nb.join(',');
      if (seen.has(k)) continue; seen.set(k, s.d + 1); q.push({ p: nr.min, b: nb, d: s.d + 1 });
      if (q.length > 400000) return best;
    }
  }
  return best;
}

// Gulv, som hverken spiller eller kasser bruger i løsningen, bliver til mur; ydre mur fjernes.
function trim(rows, path) {
  var g = rows.map(function (r) { return r.split(''); }), H = g.length, W = g[0].length, used = {};
  var p = null, boxes = [];
  g.forEach(function (r, y) { r.forEach(function (c, x) { if (c === '@' || c === '+') p = [x, y]; if (c === '$' || c === '*') boxes.push(x + ',' + y); if ('.*+'.indexOf(c) >= 0) used[x + ',' + y] = 1; }); });
  used[p] = 1; boxes.forEach(function (b) { used[b] = 1; });
  var M = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  path.split('').forEach(function (m) {
    var d = M[m]; p = [p[0] + d[0], p[1] + d[1]]; used[p] = 1;
    var bi = boxes.indexOf(p.join(','));
    if (bi >= 0) { var nb = [p[0] + d[0], p[1] + d[1]]; boxes[bi] = nb.join(','); used[nb] = 1; }
  });
  g.forEach(function (r, y) { r.forEach(function (c, x) { if (c === ' ' && !used[x + ',' + y]) r[x] = '#'; }); });
  // mur, der ikke rører gulv (heller ikke på skrå), bliver tom plads udenfor
  var floor = function (x, y) { return y >= 0 && x >= 0 && y < H && x < W && g[y][x] !== '#' && g[y][x] !== '-'; };
  var out = g.map(function (r, y) { return r.map(function (c, x) {
    if (c !== '#') return c;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (floor(x + dx, y + dy)) return '#';
    return '-'; }); });
  // fjern tomme rækker/kolonner
  out = out.filter(function (r) { return r.some(function (c) { return c !== '-'; }); });
  var keep = out[0].map(function (_, x) { return out.some(function (r) { return r[x] !== '-'; }); });
  return out.map(function (r) { return r.filter(function (_, x) { return keep[x]; }).join(''); });
}

var out = [];
for (var t = 0; t < N; t++) {
  var W = ri(6, 8), H = ri(6, 8), nb = ri(1, 4);
  var g = room(W, H, 0.08 + rnd() * 0.18);
  if (!connected(g)) continue;
  var fc = floorCells(g); if (fc.length < nb * 3 + 4) continue;
  var goals = [];
  while (goals.length < nb) { var c = fc[ri(0, fc.length - 1)], i = c[1] * W + c[0]; if (goals.indexOf(i) < 0) goals.push(i); }
  var far = reverseFarthest(g, goals); if (!far || far.d < 2) continue;
  // spilleren står et sted i sin region, så langt fra kasserne som muligt
  var rows = g.map(function (r) { return r.slice(); });
  goals.forEach(function (i) { rows[(i / W) | 0][i % W] = '.'; });
  far.b.forEach(function (i) { var y = (i / W) | 0, x = i % W; rows[y][x] = rows[y][x] === '.' ? '*' : '$'; });
  var px = far.p % W, py = (far.p / W) | 0; rows[py][px] = rows[py][px] === '.' ? '+' : '@';
  var str = rows.map(function (r) { return r.join(''); });
  var sol = S.solve(str);
  if (!sol || sol.tooBig) continue;
  str = trim(str, sol.path);
  var sol2 = S.solve(str);
  if (!sol2 || sol2.moves !== sol.moves) continue;
  out.push({ rows: str, boxes: nb, moves: sol.moves, pushes: sol.pushes, states: sol.states, w: str[0].length, h: str.length,
             score: sol.pushes * 1.5 + sol.moves * 0.2 + Math.log2(sol.states || 1) * 1.5 });
}
out.sort(function (a, b) { return a.score - b.score; });
console.log(JSON.stringify(out));
