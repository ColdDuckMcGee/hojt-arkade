// Slangen – baner med mure: node slangen/test/baner.test.js
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = { window: {}, Math: Math, Set: Set, Map: Map, JSON: JSON };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8'), ctx);
var G = ctx.window.SlangenGame, ok = 0, fejl = 0;
function tjek(b, m) { if (b) ok++; else { fejl++; console.log('FEJL', m); } }
function seeded(a) { return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
G.BANER.forEach(function (bane) {
  [10, 15, 20].forEach(function (n) {
    var g = G.createGame(n, { bane: bane, rng: seeded(n * 7 + bane.length) }), s = g.state;
    var mure = s.obstacles.filter(function (o) { return o.mur; });
    tjek(bane === 'aaben' ? mure.length === 0 : mure.length > 0, bane + ' ' + n + ': mure (' + mure.length + ')');
    // Alle frie felter hænger sammen
    var blok = {}; s.obstacles.forEach(function (o) { blok[o.y * n + o.x] = 1; });
    var h = s.snake[0], set = {}, q = [[h.x, h.y]]; set[h.y * n + h.x] = 1;
    for (var i = 0; i < q.length; i++) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var x = q[i][0] + d[0], y = q[i][1] + d[1], k = y * n + x;
      if (x < 0 || y < 0 || x >= n || y >= n || blok[k] || set[k]) return; set[k] = 1; q.push([x, y]);
    });
    tjek(Object.keys(set).length === n * n - s.obstacles.length, bane + ' ' + n + ': brættet hænger sammen');
    tjek(s.snake.every(function (c) { return !blok[c.y * n + c.x]; }) && !blok[h.y * n + h.x + 1] && !blok[h.y * n + h.x + 4], bane + ' ' + n + ': starten og vejen foran er fri');
    tjek(s.food && !blok[s.food.y * n + s.food.x], bane + ' ' + n + ': maden ligger frit');
  });
});
// Spil mange tilfældige træk: ingen undtagelser, og at gå ind i en mur er døden
G.BANER.slice(1).forEach(function (bane) {
  for (var spil = 0; spil < 30; spil++) {
    var r = seeded(spil + 99), g = G.createGame(15, { bane: bane, rng: r }), n = 0;
    try {
      while (!g.state.over && n++ < 400) {
        var dirs = ['up', 'down', 'left', 'right'].filter(function (d) { return g.canMove(d); });
        // foretræk træk mod maden, ellers tilfældigt
        var h = g.state.snake[0], f = g.state.food || h;
        dirs.sort(function () { return r() - 0.5; });
        g.step(dirs[0]);
      }
      tjek(true, '');
    } catch (e) { tjek(false, bane + ': undtagelse ' + e.message); }
    if (g.state.over && g.state.reason === 'obstacle') {
      var c = g.state.crash, o = g.state.obstacles.some(function (x) { return x.x === c.x && x.y === c.y; });
      tjek(o, bane + ': dødsårsag "obstacle" er en forhindring eller mur');
    }
  }
});
console.log(ok + ' af ' + (ok + fejl) + ' test bestået');
process.exit(fejl ? 1 : 0);
