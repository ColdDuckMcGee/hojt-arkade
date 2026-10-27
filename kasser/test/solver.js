/*
 * Kasser – løser (bruges af testen og af banegeneratoren, ikke af spillet).
 * Finder den korteste løsning målt i træk (bredde-først søgning over spiller + kasser).
 * Baner skrives i det almindelige Sokoban-format:
 *   #  væg      (mellemrum) gulv    .  mål
 *   $  kasse    *  kasse på mål     @  spiller    +  spiller på mål
 */
'use strict';
var DIRS = [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]];

function parse(rows) {
  var h = rows.length, w = 0;
  rows.forEach(function (r) { w = Math.max(w, r.length); });
  var wall = [], goal = [], boxes = [], player = -1;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var c = rows[y][x] || ' ', i = y * w + x;
    wall[i] = c === '#'; goal[i] = c === '.' || c === '*' || c === '+';
    if (c === '$' || c === '*') boxes.push(i);
    if (c === '@' || c === '+') player = i;
  }
  return { w: w, h: h, wall: wall, goal: goal, boxes: boxes.sort(function (a, b) { return a - b; }), player: player };
}

function key(p, boxes) { return String.fromCharCode(p) + String.fromCharCode.apply(null, boxes); }

// Simple døde felter: hjørner uden mål (bruges kun til at beskære søgningen).
function deadCorners(L) {
  var dead = [];
  for (var i = 0; i < L.w * L.h; i++) {
    var x = i % L.w, y = (i / L.w) | 0;
    if (L.wall[i] || L.goal[i]) { dead[i] = false; continue; }
    var W = function (xx, yy) { return xx < 0 || yy < 0 || xx >= L.w || yy >= L.h || L.wall[yy * L.w + xx]; };
    dead[i] = (W(x - 1, y) || W(x + 1, y)) && (W(x, y - 1) || W(x, y + 1));
  }
  return dead;
}

// Returnerer { moves, pushes, path: 'udlr...' } eller null, hvis banen ikke kan løses.
function solve(rows, opts) {
  var L = typeof rows[0] === 'string' ? parse(rows) : rows;
  var limit = (opts && opts.limit) || 3e6;
  var dead = deadCorners(L);
  var goals = 0; L.goal.forEach(function (g) { if (g) goals++; });
  if (goals !== L.boxes.length) return null;
  var isGoal = L.goal, w = L.w, h = L.h;
  function solved(bx) { for (var i = 0; i < bx.length; i++) if (!isGoal[bx[i]]) return false; return true; }
  var start = { p: L.player, b: L.boxes };
  if (solved(start.b)) return { moves: 0, pushes: 0, path: '' };
  var seen = new Map(); seen.set(key(start.p, start.b), null);
  var q = [start], qi = 0;
  while (qi < q.length) {
    if (seen.size > limit) return { tooBig: true };
    var s = q[qi++], sk = key(s.p, s.b);
    var px = s.p % w, py = (s.p / w) | 0;
    for (var d = 0; d < 4; d++) {
      var nx = px + DIRS[d][1], ny = py + DIRS[d][2];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      var n = ny * w + nx;
      if (L.wall[n]) continue;
      var bi = s.b.indexOf(n), nb = s.b, pushed = false;
      if (bi >= 0) {
        var bx = nx + DIRS[d][1], by = ny + DIRS[d][2];
        if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
        var t = by * w + bx;
        if (L.wall[t] || s.b.indexOf(t) >= 0 || dead[t]) continue;
        nb = s.b.slice(); nb[bi] = t; nb.sort(function (a, b) { return a - b; });
        pushed = true;
      }
      var k = key(n, nb);
      if (seen.has(k)) continue;
      seen.set(k, { from: sk, m: pushed ? DIRS[d][0].toUpperCase() : DIRS[d][0] });
      var ns = { p: n, b: nb };
      if (pushed && solved(nb)) {
        var path = '', cur = k;
        while (seen.get(cur)) { var e = seen.get(cur); path = e.m + path; cur = e.from; }
        return { moves: path.length, pushes: path.replace(/[udlr]/g, '').length, path: path.toLowerCase(), raw: path, states: seen.size };
      }
      q.push(ns);
    }
  }
  return null;
}

var api = { parse: parse, solve: solve, deadCorners: deadCorners };
if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.KasserSolver = api;
