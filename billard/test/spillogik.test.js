// Logiktest af Billard (uden browser): node billard/test/spillogik.test.js
// Fysik (friktion, elastiske stød, bander, huller), forhåndslinjen, reglerne
// (grupper, fejlstød, 8'eren), serien (kuglen i hånden, point, tabt parti) og
// computerens stød på de tre niveauer.
'use strict';
var assert = require('assert');
var path = require('path');
var L = require(path.join(__dirname, '..', 'js', 'logik.js'));
var AI = require(path.join(__dirname, '..', 'js', 'ai.js'));

var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
}
function near(a, b, eps) { return Math.abs(a - b) <= eps; }
function balls(list) { return list.map(function (b) { return { id: b[0], x: b[1], y: b[2], in: true }; }); }
function by(bs, id) { return L.ballById(bs, id); }
var R = L.R;

// ---------- Fysik ----------
test('stødbolden ruller ligeud og stopper (friktion)', function () {
  var r = L.simulate(balls([[0, 200, 250]]), 0, 3);
  var c = by(r.balls, 0);
  assert.ok(c.in);
  assert.ok(near(c.y, 250, 1e-9), 'y ændrede sig');
  assert.ok(near(c.x - 200, L.rollDistance(3), 6), 'rullede ' + (c.x - 200) + ', ventede ' + L.rollDistance(3));
  assert.strictEqual(r.first, null);
  assert.strictEqual(r.cushions, 0);
});
test('mere kraft = længere rul (monotont, kraft 1–10)', function () {
  var last = 0;
  for (var p = 1; p <= 4; p++) { var d = L.rollDistance(p); assert.ok(d > last, 'kraft ' + p); last = d; }
  assert.strictEqual(L.RULES.powers, 10);
});
test('fysikken er deterministisk (samme stød = samme resultat)', function () {
  var b = L.rack(L.rng(42));
  var a = L.simulate(b, 1.3, 10), c = L.simulate(b, 1.3, 10);
  assert.deepStrictEqual(a.balls, c.balls);
  assert.deepStrictEqual(a.pocketed, c.pocketed);
  assert.strictEqual(a.frames.length, c.frames.length);
});
test('lige stød: stødbolden står næsten stille, objektkuglen kører videre (elastisk)', function () {
  var r = L.simulate(balls([[0, 200, 250], [1, 400, 250]]), 0, 4);
  assert.strictEqual(r.first, 1);
  var c = by(r.balls, 0), o = by(r.balls, 1);
  assert.ok(c.x < 400 - 2 * R + 30, 'stødbolden fortsatte for langt: ' + c.x);
  assert.ok(o.x > 500, 'objektkuglen kom kun til ' + o.x);
  assert.ok(near(o.y, 250, 0.5));
});
test('skråt stød: kuglerne går ca. 90° fra hinanden', function () {
  var bs = balls([[0, 200, 250], [1, 400, 250 + R]]);      // halvkugle-ramt
  var pv = L.preview(bs, 0);
  assert.strictEqual(pv.hit.type, 'kugle');
  var dot = pv.hit.obj.x * pv.hit.cue.x + pv.hit.obj.y * pv.hit.cue.y;
  assert.ok(near(dot, 0, 1e-9), 'forhåndslinjen: ikke vinkelret (' + dot + ')');
  var r = L.simulate(bs, 0, 6), o = by(r.balls, 1), c = by(r.balls, 0);
  assert.ok(o.y > 250 + R + 20, 'objektkuglen gik ikke nedad');
  assert.ok(c.y < 250, 'stødbolden gik ikke opad');
});
test('bande: indfaldsvinkel = udfaldsvinkel, og farten falder', function () {
  var r = L.simulate(balls([[0, 300, 250]]), 45, 3);
  assert.ok(r.cushions >= 1, 'intet hop');
  var c = by(r.balls, 0);
  assert.ok(c.y < H() - R - 1 && c.x > 300, 'endte ' + c.x + ',' + c.y);
  function H() { return L.H; }
  var pv = L.preview(balls([[0, 300, 250]]), 45);
  assert.strictEqual(pv.hit.type, 'bande');
  assert.ok(near(pv.hit.refl.x, Math.SQRT1_2, 1e-9) && near(pv.hit.refl.y, -Math.SQRT1_2, 1e-9));
});
test('ingen kugle kommer ud af bordet uden at gå i hul (200 tilfældige stød)', function () {
  var rand = L.rng(9);
  for (var i = 0; i < 200; i++) {
    var b = L.rack(L.rng(i + 1));
    var r = L.simulate(b, rand() * 360, 1 + Math.floor(rand() * 10));
    r.balls.forEach(function (x) {
      if (!x.in) { assert.ok(r.pocketed.indexOf(x.id) >= 0); return; }
      assert.ok(x.x >= R - 0.5 && x.x <= L.W - R + 0.5 && x.y >= R - 0.5 && x.y <= L.H - R + 0.5, 'kugle ' + x.id + ' på ' + x.x + ',' + x.y);
    });
    // og ingen kugler ligger oven i hinanden
    var live = r.balls.filter(function (x) { return x.in; });
    for (var a = 0; a < live.length; a++) for (var c = a + 1; c < live.length; c++)
      assert.ok(Math.hypot(live[a].x - live[c].x, live[a].y - live[c].y) > 2 * R - 1.5, 'overlap ' + live[a].id + '/' + live[c].id);
  }
});
test('hjørnehul: kugle lige mod hjørnet går i hul', function () {
  var r = L.simulate(balls([[0, 300, 300], [1, 100, 100]]), 225, 6);
  assert.ok(r.pocketed.indexOf(1) >= 0, 'kugle 1 gik ikke i hul');
  assert.strictEqual(r.pocketAt[1], 0);
});
test('midterhul: kugle lige mod midterhullet går i hul', function () {
  var r = L.simulate(balls([[0, 500, 300], [1, 500, 150]]), 270, 5);
  assert.ok(r.pocketed.indexOf(1) >= 0);
  assert.strictEqual(r.pocketAt[1], 1);
});
test('stødbolden kan gå i hul (scratch)', function () {
  var r = L.simulate(balls([[0, 100, 400], [1, 600, 100]]), 135, 6);
  assert.ok(r.pocketed.indexOf(0) >= 0);
});

// ---------- Forhåndslinjen ----------
test('forhåndslinjen finder den første kugle og spøgelseskuglen', function () {
  var bs = balls([[0, 200, 250], [3, 500, 250], [9, 700, 250]]);
  var pv = L.preview(bs, 0);
  assert.strictEqual(pv.hit.type, 'kugle'); assert.strictEqual(pv.hit.id, 3);
  assert.ok(near(pv.hit.ghost.x, 500 - 2 * R, 1e-6));
  assert.ok(near(pv.hit.objLen, 1, 1e-9));
  var sim = L.simulate(bs, 0, 5);
  assert.strictEqual(sim.first, pv.hit.id, 'fysikken og forhåndslinjen er uenige');
});
test('forhåndslinjen viser hullet, når stødbolden løber direkte i hul', function () {
  var pv = L.preview(balls([[0, 300, 300]]), 225);
  assert.strictEqual(pv.hit.type, 'hul'); assert.strictEqual(pv.hit.pocket, 0);
});
test('forhåndslinjen og fysikken er enige om første kugle (300 stød)', function () {
  var rand = L.rng(5), agree = 0, total = 0;
  for (var i = 0; i < 300; i++) {
    var b = L.rack(L.rng(i + 100));
    var s1 = L.simulate(b, rand() * 40 - 20, 10);
    var aim = rand() * 360, pv = L.preview(s1.balls, aim);
    if (!pv || pv.hit.type !== 'kugle') continue;
    total++;
    if (L.simulate(s1.balls, aim, 5).first === pv.hit.id) agree++;
  }
  assert.ok(agree / total > 0.97, agree + '/' + total);
});

// ---------- Reglerne ----------
function sim(first, pocketed) { return { first: first, pocketed: pocketed }; }
test('gruppen tildeles ved første lovlige nedlægning', function () {
  var j = L.judge({ group: null, onEight: false, breakShot: false }, sim(3, [3]));
  assert.strictEqual(j.foul, false); assert.strictEqual(j.assign, 'hel'); assert.ok(j.continues);
  j = L.judge({ group: null, onEight: false, breakShot: false }, sim(3, [12]));
  assert.strictEqual(j.assign, 'halv');
});
test('ingen gruppe ved fejlstød', function () {
  var j = L.judge({ group: null, onEight: false, breakShot: false }, sim(3, [3, 0]));
  assert.ok(j.foul); assert.strictEqual(j.assign, null); assert.strictEqual(j.reason, 'stoed');
});
test('fejlstød: ingen kugle ramt, forkert kugle først, 8\'eren for tidligt', function () {
  assert.strictEqual(L.judge({ group: 'hel', onEight: false }, sim(null, [])).reason, 'ingen');
  assert.strictEqual(L.judge({ group: 'hel', onEight: false }, sim(11, [])).reason, 'forkert');
  assert.strictEqual(L.judge({ group: 'hel', onEight: true }, sim(2, [])).reason, 'ikke8');
  assert.strictEqual(L.judge({ group: null, onEight: false, breakShot: false }, sim(8, [])).reason, 'aaben8');
  assert.strictEqual(L.judge({ group: 'hel', onEight: false }, sim(3, [])).foul, false);
});
test('8\'eren: vinder kun, når egne er nedlagt og stødet er lovligt', function () {
  assert.strictEqual(L.judge({ group: 'hel', onEight: true }, sim(8, [8])).frame, 'win');
  assert.strictEqual(L.judge({ group: 'hel', onEight: true }, sim(8, [8, 0])).frame, 'lose');
  assert.strictEqual(L.judge({ group: 'hel', onEight: false }, sim(3, [3, 8])).frame, 'lose');
  assert.strictEqual(L.judge({ group: null, onEight: false, breakShot: false }, sim(3, [8])).frame, 'lose');
});
test('8\'eren i hul på åbningsstødet sættes op igen', function () {
  var j = L.judge({ group: null, onEight: false, breakShot: true }, sim(1, [8, 5]));
  assert.strictEqual(j.frame, null); assert.ok(j.respotEight); assert.strictEqual(j.assign, 'hel');
});
test('modstanderens kugle i hul giver ikke et stød mere', function () {
  var j = L.judge({ group: 'hel', onEight: false }, sim(2, [12]));
  assert.strictEqual(j.foul, false); assert.deepStrictEqual(j.opp, [12]); assert.strictEqual(j.continues, false);
});

// ---------- Serien ----------
test('serien starter med en opstilling: 15 kugler + stødbold, du slår op', function () {
  var run = L.createSeries('normal', 1), s = run.state;
  assert.strictEqual(s.balls.length, 16); assert.strictEqual(s.turn, 'human'); assert.ok(s.breakShot);
  assert.strictEqual(s.frame, 1); assert.strictEqual(s.score, 0);
  var ids = s.balls.map(function (b) { return b.id; }).sort(function (a, b) { return a - b; });
  assert.deepStrictEqual(ids, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.strictEqual(by(s.balls, 8).x, s.balls.filter(function (b) { return b.id; }).sort(function (a, b) { return a.x - b.x; })[5].x, '8\'eren står ikke i midten');
});
test('retning: ±1°/±10°, klik på bordet, kraft 1–10', function () {
  var run = L.createSeries('normal', 1);
  run.setAim(350); run.turnAim(10); assert.strictEqual(run.state.aim, 0);
  run.turnAim(-1); assert.strictEqual(run.state.aim, 359);
  run.aimAt({ x: L.RULES.headSpot.x, y: 0 }); assert.strictEqual(run.state.aim, 270);
  assert.strictEqual(run.setPower(14), 10); assert.strictEqual(run.setPower(0), 1);
});
test('Næste kugle sigter på lovlige kugler og skifter mellem dem', function () {
  var run = L.createSeries('normal', 1);
  run._setBalls(balls([[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]]), { groups: { human: 'hel', cpu: 'halv' } });
  var a = run.nextTarget(true);
  assert.strictEqual(a.id, 2);
  var pv = run.preview();
  assert.strictEqual(pv.hit.id, 2);
  var r = run.shoot();
  assert.ok(r.judge.own.indexOf(2) >= 0, 'Næste kugle + kraft nedlagde ikke kuglen');
  assert.strictEqual(run.state.turn, 'human');
  assert.deepStrictEqual(run.legalTargets('human'), [8]);
  assert.strictEqual(run.nextTarget(true).id, 8);
});
test('fejlstød giver modstanderen kuglen i hånden (spilleren: lagt automatisk, kan flyttes)', function () {
  var run = L.createSeries('normal', 1);
  run._setBalls(balls([[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]]), { groups: { human: 'halv', cpu: 'hel' }, turn: 'cpu' });
  run.setAim(90); run.setPower(1);               // computeren rammer ingenting
  var r = run.shoot();
  assert.ok(r.judge.foul); assert.strictEqual(run.state.turn, 'human');
  assert.ok(run.state.ballInHand); assert.ok(run.state.handSpots.length >= 2);
  var c0 = Object.assign({}, by(run.state.balls, 0));
  var m = run.moveCue();
  var c1 = by(run.state.balls, 0);
  assert.ok(m && (c0.x !== c1.x || c0.y !== c1.y), 'Flyt flyttede ikke stødbolden');
  assert.ok(!L.overlapsAny(run.state.balls, c1.x, c1.y, 0));
});
test('stødbolden i hul uden fejl på hånden: den kommer op på bagfeltets punkt', function () {
  var run = L.createSeries('normal', 1);
  run._setBalls(balls([[0, 100, 400], [2, 500, 150], [10, 600, 350], [8, 800, 250]]), { groups: { human: 'hel', cpu: 'halv' } });
  run.setAim(135); run.setPower(6);
  var r = run.shoot();
  assert.ok(r.judge.cueIn); assert.strictEqual(run.state.turn, 'cpu'); assert.ok(run.state.ballInHand);
  assert.ok(by(run.state.balls, 0).in);
});
test('point: egne kugler og vundne partier ganges med niveauet; tabt parti slutter serien', function () {
  ['rolig', 'normal', 'svaer'].forEach(function (lv, k) {
    var run = L.createSeries(lv, 1), mult = k + 1;
    run._setBalls(balls([[0, 300, 300], [1, 100, 100], [8, 800, 250]]), { groups: { human: 'hel', cpu: 'halv' } });
    run.setAim(225); run.setPower(6);
    var r = run.shoot();
    assert.deepStrictEqual(r.judge.own, [1]);
    assert.strictEqual(run.state.score, 10 * mult, lv);
    // 8'eren: lige i hjørnet
    run._setBalls(balls([[0, 300, 300], [8, 100, 100]]), { groups: { human: 'hel', cpu: 'halv' } });
    run.setAim(225); run.setPower(6);
    r = run.shoot();
    assert.strictEqual(r.winner, 'human');
    assert.strictEqual(run.state.score, 110 * mult, lv);
    assert.strictEqual(run.state.framesWon, 1);
    assert.ok(run.nextFrame());
    assert.strictEqual(run.state.frame, 2); assert.strictEqual(run.state.turn, 'cpu', 'computeren slår op i parti 2');
    // Tabt parti: 8'eren for tidligt
    run._setBalls(balls([[0, 300, 300], [8, 100, 100], [3, 700, 400]]), { groups: { human: 'hel', cpu: 'halv' }, turn: 'human' });
    run.setAim(225); run.setPower(6);
    r = run.shoot();
    assert.strictEqual(r.winner, 'cpu'); assert.ok(run.state.over); assert.strictEqual(run.nextFrame(), false);
    assert.strictEqual(run.shoot().ok, false);
  });
});
test('computerens point tæller ikke med i dine', function () {
  var run = L.createSeries('svaer', 1);
  run._setBalls(balls([[0, 300, 300], [9, 100, 100], [8, 800, 250], [2, 700, 400]]), { groups: { human: 'hel', cpu: 'halv' }, turn: 'cpu' });
  run.setAim(225); run.setPower(6);
  run.shoot();
  assert.strictEqual(run.state.score, 0);
});

// ---------- Computeren ----------
test('computeren nedlægger en let kugle (alle niveauer) og bruger kort tid', function () {
  ['rolig', 'normal', 'svaer'].forEach(function (lv) {
    var hits = 0;
    for (var s = 1; s <= 12; s++) {
      var run = L.createSeries(lv, s);
      run._setBalls(balls([[0, 300, 300], [9, 150, 150], [8, 800, 250], [2, 700, 400]]), { groups: { human: 'hel', cpu: 'halv' }, turn: 'cpu' });
      var t0 = Date.now(), plan = AI.plan(run), dt = Date.now() - t0;
      assert.ok(dt < 1500, lv + ' tænkte ' + dt + ' ms');
      run.prepareCpu(plan);
      var r = run.shoot();
      if (r.judge.own.indexOf(9) >= 0) hits++;
    }
    assert.ok(hits >= (lv === 'rolig' ? 3 : lv === 'normal' ? 5 : 10), lv + ' ramte ' + hits + '/12');
  });
});
test('computeren med kuglen i hånden vælger selv et frit sted', function () {
  var run = L.createSeries('normal', 3);
  run._setBalls(balls([[0, 300, 250], [9, 500, 150], [2, 600, 350], [8, 800, 250]]), { groups: { human: 'hel', cpu: 'halv' }, turn: 'cpu' });
  run.state.ballInHand = true;
  var plan = AI.plan(run);
  assert.ok(plan.spot, 'intet sted');
  run.prepareCpu(plan);
  var c = by(run.state.balls, 0);
  assert.ok(!L.overlapsAny(run.state.balls, c.x, c.y, 0));
});
test('Svær vinder oftere end Rolig (computer mod computer, 16 partier)', function () {
  function play(a, b, seed) {
    // a slår op; skifter tur efter reglerne. Returnerer vinderen ('a' eller 'b').
    var run = L.createSeries('normal', seed), st = run.state;
    var lv = { human: L.LEVELS[a], cpu: L.LEVELS[b] };
    for (var k = 0; k < 160 && run.live(); k++) {
      var who = st.turn;
      run.level = lv[who];
      st.turn = 'cpu'; var g = st.groups; st.groups = who === 'cpu' ? g : { human: g.cpu, cpu: g.human };
      var plan = AI.plan(run);
      st.groups = g; st.turn = who;
      if (st.ballInHand && plan.spot) run.placeCue(plan.spot);
      run.setAim(plan.aim); run.setPower(plan.power);
      run.shoot();
    }
    return st.frameOver === 'human' ? 'a' : st.frameOver === 'cpu' ? 'b' : null;
  }
  var sv = 0, ro = 0;
  for (var s = 1; s <= 8; s++) {
    var w1 = play('svaer', 'rolig', s), w2 = play('rolig', 'svaer', 100 + s);
    if (w1 === 'a') sv++; else if (w1 === 'b') ro++;
    if (w2 === 'b') sv++; else if (w2 === 'a') ro++;
  }
  console.log('     Svær ' + sv + ' – Rolig ' + ro);
  assert.ok(sv > ro, 'Svær ' + sv + ', Rolig ' + ro);
});
test('et helt parti kan spilles færdigt (du med Næste kugle mod Svær)', function () {
  var run = L.createSeries('svaer', 5), st = run.state;
  for (var k = 0; k < 200 && run.live(); k++) {
    if (st.turn === 'cpu') run.prepareCpu(AI.plan(run));
    else if (!st.breakShot) run.nextTarget(true);
    else run.setPower(10);
    run.shoot();
  }
  assert.ok(!run.live(), 'partiet sluttede ikke');
  assert.ok(st.frameOver === 'human' || st.frameOver === 'cpu');
});

console.log('\n' + (n - failed) + ' af ' + n + ' test bestået');
process.exit(failed ? 1 : 0);
