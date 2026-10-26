/*
 * Flipper – spillogik og fysik (ingen DOM). Kan køres i browseren og med node.
 *
 * Bordet er 600 × 1000 enheder og står på højkant. Kuglen ruller frit med
 * tyngdekraft, rammer vægge, bumpere, slynger og mål. Fysikken regnes i faste
 * tidsskridt (STEP = 1/120 s), og hvert skridt deles i SUBSTEPS små delskridt,
 * så kuglen aldrig kan smutte igennem en væg (tunneling). Der bruges ingen
 * tilfældighed, så samme udgangspunkt altid giver præcis samme bane. Derfor kan
 * sigtelinjerne regnes med den samme fysik: det, man ser, er det, der sker.
 *
 * Øjenstyring – ingen timing og intet tidspres:
 *  - Når kuglen kommer ned i frysezonen over flipperne (på vej ned) og er på vej
 *    hen til en flipper eller ud gennem midten, fryser spillet (fase 'decision').
 *    Man vælger flipper ('left', 'right' eller 'both') og tidspunkt ('early' =
 *    Tidligt eller 'late' = Sent) – eller 'none' (Lad være). Ruller kuglen bare op
 *    igen fra en skrå væg eller en slynge, er der intet at vælge, og der fryses ikke.
 *  - Tidspunktet bestemmer, hvor på flipperen kuglen rammes, og dermed retningen:
 *      Tidligt: kuglen rammes ude ved spidsen og sendes skråt over bordet.
 *      Sent:    kuglen rammes inde ved leddet og sendes næsten lige op.
 *    Slagpunktet regnes deterministisk ud fra kuglens afstand til aksen, når den
 *    kommer inden for flipperens rækkevidde (se hitPoint). Selve slaget sker i det
 *    øjeblik, så spilleren aldrig skal ramme et tidspunkt.
 *  - Spillet fryser også, hvis kuglen ligger stille eller ruller meget langsomt
 *    nede ved flipperne, så man aldrig taber en kugle uden at have haft et valg.
 *  - Ligger kuglen stille et andet sted på bordet, får den et lille puf.
 *
 * Point (ganges med multiplikatoren, ×1 til ×5):
 *   bumper 100, slynge 10, lysmål 250 (50, hvis det allerede er tændt),
 *   sløjfe 500, alle fem lys tændt 2000 – og multiplikatoren stiger med 1.
 *   Multiplikatoren nulstilles, når en kugle er tabt. Lysene bliver stående.
 *   Ekstra kugle ved 40 000 og 100 000 point.
 */
(function (global) {
  'use strict';

  var W = 600, H = 1000;
  var STEP = 1 / 120, SUBSTEPS = 4;
  var R = 12;                 // kuglens radius
  var GRAVITY = 1000;         // enheder/s² (bordets hældning)
  var MAX_SPEED = 2400;
  var ZONE_Y = 790;           // frysezonens øverste kant
  var LANE_X = 540;           // afskydningsbanen ligger til højre for denne linje
  var REARM_V = 60;           // kuglen er på vej op igen: et nyt valg kommer næste gang
  var STALL_V = 25, STALL_ZONE_T = 0.5, STALL_TABLE_T = 1.5;
  var PREVIEW_T = 2.0;        // sigtelinjernes længde i sekunder
  var POWERS = [1450, 1560, 1670, 1780, 1890];
  var REST = { x: 560, y: 975 };
  var EXTRA_AT = [40000, 100000];
  var BALLS = 3;
  var TIMINGS = ['early', 'late'];

  var SPEEDS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  factor: 0.4 },
    normal: { id: 'normal', name: 'Normal', factor: 0.6 },
    hurtig: { id: 'hurtig', name: 'Hurtig', factor: 0.85 }
  };
  var SPEED_IDS = ['rolig', 'normal', 'hurtig'];

  var POINTS = { bumper: 100, sling: 10, target: 250, targetLit: 50, loop: 500, allLights: 2000 };

  // ---------- Bordet ----------
  // Vægge er "kapsler": et linjestykke med en tykkelse (r).
  var WALLS = [];
  function wall(ax, ay, bx, by, o) {
    o = o || {};
    var s = { kind: o.kind || 'wall', ax: ax, ay: ay, bx: bx, by: by, r: o.r || 3, e: o.e == null ? 0.45 : o.e };
    for (var k in o) if (!(k in s)) s[k] = o[k];
    WALLS.push(s);
    return s;
  }
  // Toppen: en halv ellipse fra venstre væg til højre ydervæg
  (function () {
    var cx = 300, cy = 200, rx = 280, ry = 170, n = 28, prev = null;
    for (var i = 0; i <= n; i++) {
      var a = Math.PI + Math.PI * i / n;
      var p = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      if (prev) wall(prev.x, prev.y, p.x, p.y, { r: 3, e: 0.3, part: 'top' });
      prev = p;
    }
  })();
  wall(20, 200, 20, 690);                 // venstre væg
  wall(20, 690, 147, 882);                // skrå væg ned mod venstre flipper
  wall(580, 200, 580, 995);               // højre ydervæg
  wall(LANE_X, 250, LANE_X, 995);         // afskydningsbanens indervæg
  wall(LANE_X, 690, 413, 882);            // skrå væg ned mod højre flipper
  wall(LANE_X, 995, 580, 995, { e: 0.1 }); // stemplets bund
  // Envejslåge øverst i afskydningsbanen: kuglen kan komme op, men ikke falde ned i banen igen.
  // Den rammes kun fra spillepladens side (normalen peger op mod venstre).
  wall(LANE_X, 250, 580, 214, { kind: 'gate', e: 0.3, nx: -0.669, ny: -0.743 });
  // Sløjfer: en smal bane i hver side med en tragt forneden, der leder kuglen ind
  wall(85, 300, 85, 430, { r: 4 });
  wall(85, 430, 112, 470, { r: 4 });
  wall(475, 300, 475, 430, { r: 4 });
  wall(475, 430, 448, 470, { r: 4 });
  // Slynger (trekanter). Den skrå side mod midten sparker kuglen væk.
  var SLINGS = [];
  function sling(ax, ay, bx, by, cx, cy, side) {
    SLINGS.push({ side: side, pts: [[ax, ay], [bx, by], [cx, cy]] });
    wall(ax, ay, bx, by, { r: 4 });
    wall(bx, by, cx, cy, { r: 4 });
    wall(ax, ay, cx, cy, { r: 4, kind: 'sling', side: side, kick: 760, e: 0.5 });
  }
  sling(80, 620, 80, 720, 140, 770, 'left');
  sling(480, 620, 480, 720, 420, 770, 'right');
  // Lysmål: fem små mål på række øverst
  var TARGETS = [];
  [180, 230, 280, 330, 380].forEach(function (x, i) {
    TARGETS.push(wall(x - 17, 165, x + 17, 165, { r: 5, kind: 'target', index: i, e: 0.5 }));
  });
  var BUMPERS = [
    { x: 200, y: 300, r: 30, kick: 820 },
    { x: 360, y: 300, r: 30, kick: 820 },
    { x: 280, y: 410, r: 30, kick: 820 }
  ];
  // Sløjfernes følere: kuglen passerer linjen på vej op
  var LOOPS = [
    { side: 'left', x0: 20, x1: 85, y: 320 },
    { side: 'right', x0: 475, x1: LANE_X, y: 320 }
  ];
  // Flipperne: akse, længde, hvileposition (peger ned mod midten) og slag-position
  var FLIP_LEN = 88, FLIP_R = 9, FLIP_REST = 30, FLIP_UP = -28;
  var FLIP_REACH = FLIP_LEN + R - 1;
  var FLIPPERS = {
    left:  { side: 'left',  x: 160, y: 896, dir: 1 },
    right: { side: 'right', x: 400, y: 896, dir: -1 }
  };
  var FLIP_HIT_T = 0.12, FLIP_UP_T = 0.35;

  // Flipperens vinkel (grader) set fra aksen. dir = 1: peger mod højre. Positiv vinkel = nedad.
  function flipperAngle(state, side) {
    var t = state.flip[side];
    if (t < 0) return FLIP_REST;
    if (t < 0.05) return FLIP_REST + (FLIP_UP - FLIP_REST) * (t / 0.05);
    if (t < FLIP_UP_T - 0.1) return FLIP_UP;
    if (t < FLIP_UP_T) return FLIP_UP + (FLIP_REST - FLIP_UP) * ((t - (FLIP_UP_T - 0.1)) / 0.1);
    return FLIP_REST;
  }
  function flipperSegment(state, side) {
    var f = FLIPPERS[side], a = flipperAngle(state, side) * Math.PI / 180;
    return { ax: f.x, ay: f.y, bx: f.x + f.dir * FLIP_LEN * Math.cos(a), by: f.y + FLIP_LEN * Math.sin(a), r: FLIP_R, e: 0.3, kind: 'flipper', side: side };
  }

  // ---------- Hjælpere ----------
  // Slagpunktet på flipperen (0 = ved leddet, 1 = ude ved spidsen) ud fra kuglens
  // afstand til aksen (s, 0–1), når den kommer inden for rækkevidde, og tidspunktet.
  // Tidligt ligger altid i 0,70–1,00 og Sent i 0,10–0,35, så udfaldene er tydeligt forskellige.
  function hitPoint(s, timing) {
    s = clamp(s, 0, 1);
    return timing === 'late' ? 0.10 + 0.25 * s : 0.70 + 0.30 * s;
  }
  function parseChoice(option, timing) {
    if (typeof option !== 'string') return null;
    var m = option.split('-');
    if (m.length === 2) { option = m[0]; timing = m[1]; }
    if (option === 'none') return { option: 'none', timing: null, key: 'none' };
    if (['left', 'right', 'both'].indexOf(option) < 0 || TIMINGS.indexOf(timing) < 0) return null;
    return { option: option, timing: timing, key: option + '-' + timing };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function newState(speedId, gravity) {
    return {
      speedId: SPEEDS[speedId] ? speedId : 'normal',
      gravity: gravity == null ? GRAVITY : gravity,   // kun testene ændrer den
      phase: 'launch', reason: '',
      ball: { x: REST.x, y: REST.y, vx: 0, vy: 0 },
      score: 0, ballsLeft: BALLS, ballNo: 1, mult: 1,
      lights: [false, false, false, false, false],
      armed: null, decided: false, choice: null, timing: null, skipped: false,
      stallT: 0, flip: { left: -1, right: -1 },
      time: 0, power: 3, extraIdx: 0,
      stats: { bumpers: 0, slings: 0, targets: 0, allLights: 0, loops: 0, flips: 0, freezes: 0, extra: 0, bestMult: 1 },
      events: []
    };
  }
  function cloneState(s) {
    return {
      speedId: s.speedId, gravity: s.gravity, phase: s.phase, reason: s.reason,
      ball: { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy },
      score: s.score, ballsLeft: s.ballsLeft, ballNo: s.ballNo, mult: s.mult,
      lights: s.lights.slice(),
      armed: s.armed ? { left: s.armed.left, right: s.armed.right, timing: s.armed.timing } : null,
      decided: s.decided, choice: s.choice, timing: s.timing, skipped: s.skipped,
      stallT: s.stallT, flip: { left: s.flip.left, right: s.flip.right },
      time: s.time, power: s.power, extraIdx: s.extraIdx,
      stats: Object.assign({}, s.stats),
      events: []
    };
  }

  function createRun(opts) {
    opts = opts || {};
    var state = opts.state ? cloneState(opts.state) : newState(opts.speedId, opts.gravity);

    function emit(type, data) {
      var e = { type: type, time: state.time };
      if (data) for (var k in data) e[k] = data[k];
      state.events.push(e);
      return e;
    }
    function addPoints(base, type, data) {
      var pts = base * state.mult;
      state.score += pts;
      var e = emit(type, data); e.points = pts;
      while (state.extraIdx < EXTRA_AT.length && state.score >= EXTRA_AT[state.extraIdx]) {
        state.extraIdx++;
        state.ballsLeft++;
        state.stats.extra++;
        emit('extra', { at: EXTRA_AT[state.extraIdx - 1] });
      }
      return pts;
    }

    // ---------- Kollisioner ----------
    function collideCapsule(s, dt) {
      var b = state.ball;
      var dx = s.bx - s.ax, dy = s.by - s.ay, len2 = dx * dx + dy * dy;
      var t = len2 > 0 ? clamp(((b.x - s.ax) * dx + (b.y - s.ay) * dy) / len2, 0, 1) : 0;
      var qx = s.ax + dx * t, qy = s.ay + dy * t;
      var ex = b.x - qx, ey = b.y - qy, d2 = ex * ex + ey * ey, min = R + s.r;
      if (d2 >= min * min) return false;
      if (s.kind === 'gate') {
        // Kun fra spillepladens side
        if ((b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny < 0) return false;
      }
      var d = Math.sqrt(d2), nx, ny;
      if (d < 1e-9) { nx = -dy; ny = dx; var l = Math.sqrt(nx * nx + ny * ny) || 1; nx /= l; ny /= l; d = 0; }
      else { nx = ex / d; ny = ey / d; }
      b.x += nx * (min - d); b.y += ny * (min - d);
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        var tx = b.vx - vn * nx, ty = b.vy - vn * ny;
        var fr = 0.01;
        b.vx = tx * (1 - fr) - vn * s.e * nx;
        b.vy = ty * (1 - fr) - vn * s.e * ny;
        if (s.kind === 'sling' && -vn > 40) {
          var out = b.vx * nx + b.vy * ny;
          if (out < s.kick) { b.vx += (s.kick - out) * nx; b.vy += (s.kick - out) * ny; }
          state.stats.slings++;
          addPoints(POINTS.sling, 'sling', { side: s.side, x: qx, y: qy });
        } else if (s.kind === 'target' && -vn > 50) {
          var i = s.index;
          if (!state.lights[i]) {
            state.lights[i] = true;
            state.stats.targets++;
            addPoints(POINTS.target, 'target', { index: i, x: qx, y: qy });
            if (state.lights.every(Boolean)) {
              state.stats.allLights++;
              addPoints(POINTS.allLights, 'lights', { mult: Math.min(5, state.mult + 1) });
              state.mult = Math.min(5, state.mult + 1);
              state.stats.bestMult = Math.max(state.stats.bestMult, state.mult);
              state.lights = [false, false, false, false, false];
            }
          } else addPoints(POINTS.targetLit, 'targetLit', { index: i, x: qx, y: qy });
        }
      }
      return true;
    }
    function collideBumper(bp, i) {
      var b = state.ball;
      var ex = b.x - bp.x, ey = b.y - bp.y, d2 = ex * ex + ey * ey, min = R + bp.r;
      if (d2 >= min * min) return;
      var d = Math.sqrt(d2) || 1e-9, nx = ex / d, ny = ey / d;
      b.x = bp.x + nx * min; b.y = bp.y + ny * min;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
      var out = b.vx * nx + b.vy * ny;
      if (out < bp.kick) { b.vx += (bp.kick - out) * nx; b.vy += (bp.kick - out) * ny; }
      state.stats.bumpers++;
      addPoints(POINTS.bumper, 'bumper', { index: i, x: bp.x, y: bp.y });
    }

    // ---------- Flipperne ----------
    // Er kuglen inden for flipperens rækkevidde (området, flipperen fejer over)?
    function inReach(side) {
      var f = FLIPPERS[side], b = state.ball;
      var rx = (b.x - f.x) * f.dir, ry = b.y - f.y;
      var dist = Math.sqrt(rx * rx + ry * ry);
      if (dist > FLIP_REACH) return -1;
      var ang = Math.atan2(ry, rx) * 180 / Math.PI;
      if (ang < FLIP_UP - 12 || ang > FLIP_REST + 8) return -1;
      return clamp(dist / FLIP_LEN, 0, 1);
    }
    function fire(side, s, timing) {
      var f = FLIPPERS[side], b = state.ball, h = hitPoint(s, timing);
      // Retning: ved spidsen (h nær 1) skråt over bordet, ved leddet (h nær 0)
      // næsten lige op – lidt påvirket af, hvordan kuglen kommer ind.
      var along = (b.vx * f.dir) / 40, inSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      var heading = lerp(-92, -42, h) - clamp(along, -10, 10);
      if (f.dir < 0) heading = -180 - heading;
      var speed = lerp(1600, 1720, h) + clamp(inSpeed * 0.12, 0, 160), a = heading * Math.PI / 180;
      var hx = b.x, hy = b.y;
      b.vx = speed * Math.cos(a); b.vy = speed * Math.sin(a);
      state.flip[side] = 0;
      state.armed = null;
      state.stallT = 0;
      state.stats.flips++;
      emit('flipper', { side: side, s: s, h: h, timing: timing, x: hx, y: hy });
    }

    // ---------- Ét delskridt ----------
    function substep(dt) {
      var b = state.ball;
      ['left', 'right'].forEach(function (side) {
        if (state.flip[side] >= 0) { state.flip[side] += dt; if (state.flip[side] >= FLIP_UP_T) state.flip[side] = -1; }
      });
      b.vy += state.gravity * dt;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
      var py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // To runder, så hjørner opfører sig pænt
      for (var it = 0; it < 2; it++) {
        for (var i = 0; i < WALLS.length; i++) collideCapsule(WALLS[i], dt);
        ['left', 'right'].forEach(function (side) {
          var ft = state.flip[side];
          if (ft >= 0 && ft < FLIP_HIT_T) return; // kuglen er lige slået væk
          collideCapsule(flipperSegment(state, side), dt);
        });
      }
      for (var j = 0; j < BUMPERS.length; j++) collideBumper(BUMPERS[j], j);
      // Sløjfer
      for (var k = 0; k < LOOPS.length; k++) {
        var lp = LOOPS[k];
        if (py > lp.y && b.y <= lp.y && b.x > lp.x0 && b.x < lp.x1 && b.vy < 0) {
          state.stats.loops++;
          addPoints(POINTS.loop, 'loop', { side: lp.side, x: b.x, y: lp.y });
        }
      }
      // Ladede flippere slår selv, når kuglen er inden for rækkevidde
      if (state.armed) {
        var tl = state.armed.left ? inReach('left') : -1;
        var tr = state.armed.right ? inReach('right') : -1;
        if (tl >= 0 && (tr < 0 || b.x <= 280)) fire('left', tl, state.armed.timing);
        else if (tr >= 0) fire('right', tr, state.armed.timing);
      }
      state.time += dt;
    }

    function inZone() { var b = state.ball; return b.y > ZONE_Y && b.x < LANE_X; }
    function freeze(reason) {
      state.phase = 'decision';
      state.reason = reason;
      state.armed = null;
      state.stallT = 0;
      state.stats.freezes++;
      emit('freeze', { reason: reason });
    }
    function nudge(toDrain) {
      var b = state.ball;
      if (toDrain) { b.vx += b.x < 280 ? 120 : -120; b.vy += 60; }
      else { b.vx = b.x < 280 ? 150 : -150; b.vy = -320; }
      state.stallT = 0;
      emit('nudge', { toDrain: !!toDrain });
    }

    // ---------- Ét fast tidsskridt (1/120 s) ----------
    function step() {
      if (state.phase !== 'rolling') return state.phase;
      var dt = STEP / SUBSTEPS;
      for (var i = 0; i < SUBSTEPS; i++) {
        substep(dt);
      }
      var b = state.ball;
      // Tabt kugle (gennem midten)
      if (b.y > H + R * 2) {
        state.ballsLeft--;
        state.mult = 1;
        state.phase = 'lost';
        state.armed = null; state.decided = false;
        emit('drain', { last: state.ballsLeft <= 0 });
        return state.phase;
      }
      // Kuglen faldt tilbage i afskydningsbanen: skyd igen
      if (b.x > LANE_X && b.y >= REST.y - 1 && b.vy >= 0) {
        resetBall();
        emit('return');
        return state.phase;
      }
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      state.stallT = speed < STALL_V ? state.stallT + STEP : 0;
      if (inZone()) {
        if (b.vy < -REARM_V) { state.decided = false; state.skipped = false; state.armed = null; }
        if (!state.decided && !state.skipped && b.vy > 0) {
          if (needsChoice()) { freeze('zone'); return state.phase; }
          state.skipped = true;
        }
        if (state.stallT >= STALL_ZONE_T) {
          if (!state.decided) { freeze('stille'); return state.phase; }
          nudge(true);
        }
      } else {
        if (b.y <= ZONE_Y) { state.decided = false; state.skipped = false; state.armed = null; }
        if (state.stallT >= STALL_TABLE_T && b.x < LANE_X) nudge(false);
      }
      return state.phase;
    }

    // Skal spilleren vælge nu? Kuglen følges (med samme fysik) uden at gøre noget:
    // Kommer den inden for en flippers rækkevidde, går den tabt, eller ligger den
    // stille, så fryser spillet. Ruller den i stedet op og ud af zonen igen (fx fra
    // en skrå væg eller en slynge), er der intet at vælge, og spillet kører videre.
    // Kommer kuglen tilbage, tjekkes der igen.
    function needsChoice() {
      var copy = createRun({ state: state });
      var cs = copy.state;
      cs.skipped = true; cs.decided = false; cs.armed = null;
      for (var i = 0; i < 480; i++) {
        if (copy.inReach('left') >= 0 || copy.inReach('right') >= 0) return true;
        copy.step();
        if (cs.phase !== 'rolling') return cs.phase !== 'launch';
        if (cs.ball.y <= ZONE_Y || cs.ball.vy < -REARM_V) return false;
      }
      return true;
    }

    function resetBall() {
      state.ball = { x: REST.x, y: REST.y, vx: 0, vy: 0 };
      state.phase = 'launch';
      state.reason = '';
      state.armed = null; state.decided = false; state.skipped = false; state.stallT = 0;
      state.flip = { left: -1, right: -1 };
    }

    // ---------- Handlinger ----------
    function setPower(p) {
      if (state.phase !== 'launch') return false;
      state.power = clamp(Math.round(p), 1, POWERS.length);
      return true;
    }
    function shoot() {
      if (state.phase !== 'launch') return false;
      state.ball = { x: REST.x, y: REST.y, vx: 0, vy: -POWERS[state.power - 1] };
      state.phase = 'rolling';
      emit('launch', { power: state.power });
      return true;
    }
    // choose('left', 'early') eller choose('left-early'); 'none' kræver intet tidspunkt.
    function choose(option, timing) {
      if (state.phase !== 'decision') return false;
      var c = parseChoice(option, timing);
      if (!c) return false;
      option = c.option; timing = c.timing;
      var wasStill = state.reason === 'stille';
      state.phase = 'rolling';
      state.decided = true;
      state.choice = option;
      state.timing = timing;
      state.armed = option === 'none' ? null : { left: option !== 'right', right: option !== 'left', timing: timing };
      state.stallT = 0;
      emit('choose', { option: option, timing: timing });
      if (option === 'none' && wasStill) nudge(true);
      return true;
    }
    function nextBall() {
      if (state.phase !== 'lost') return false;
      if (state.ballsLeft <= 0) { state.phase = 'over'; emit('over'); return true; }
      state.ballNo++;
      resetBall();
      return true;
    }
    function drainEvents() { var e = state.events; state.events = []; return e; }

    // ---------- Sigtelinjer: simulér med samme fysik på en kopi ----------
    function simulate(apply, maxT) {
      var copy = createRun({ state: state });
      var before = copy.state.score;
      apply(copy);
      var path = [{ x: copy.state.ball.x, y: copy.state.ball.y }];
      var steps = Math.round((maxT || PREVIEW_T) / STEP), fired = null, hit = null, i;
      for (i = 0; i < steps && copy.state.phase === 'rolling'; i++) {
        copy.step();
        path.push({ x: copy.state.ball.x, y: copy.state.ball.y });
        if (!fired) copy.state.events.forEach(function (e) { if (e.type === 'flipper' && !fired) { fired = e.side; hit = e; } });
      }
      return {
        path: path, steps: i, fired: fired, hit: hit,
        result: copy.state.phase === 'rolling' ? 'videre' : copy.state.phase, // 'decision', 'lost', 'launch'
        drained: copy.state.phase === 'lost',
        points: copy.state.score - before,
        end: copy.state
      };
    }
    function preview(option, timing, maxT) {
      if (state.phase !== 'decision') return null;
      var c = parseChoice(option, timing);
      if (!c) return null;
      var r = simulate(function (cp) { cp.choose(c.option, c.timing); }, maxT);
      r.option = c.option; r.timing = c.timing; r.key = c.key;
      return r;
    }
    // Kan flipperen (eller en af dem ved 'both') nå kuglen? Samme for Tidligt og Sent,
    // fordi slaget sker, når kuglen kommer inden for rækkevidde.
    function canReach(option) {
      if (option === 'none') return true;
      var p = preview(option, 'early');
      return !!(p && p.fired);
    }
    function previewLaunch(power, maxT) {
      if (state.phase !== 'launch') return null;
      var r = simulate(function (c) { c.setPower(power == null ? state.power : power); c.shoot(); }, maxT || 2.6);
      r.power = power;
      return r;
    }

    return {
      get state() { return state; },
      step: step, shoot: shoot, setPower: setPower, choose: choose, nextBall: nextBall,
      preview: preview, previewLaunch: previewLaunch, canReach: canReach, drainEvents: drainEvents,
      inZone: inZone, inReach: inReach, flipperSegment: function (side) { return flipperSegment(state, side); },
      flipperAngle: function (side) { return flipperAngle(state, side); },
      // Kun til test
      _place: function (x, y, vx, vy) { state.ball = { x: x, y: y, vx: vx || 0, vy: vy || 0 }; state.phase = 'rolling'; state.decided = false; state.skipped = false; state.armed = null; state.stallT = 0; }
    };
  }

  global.FlipperGame = {
    W: W, H: H, R: R, STEP: STEP, SUBSTEPS: SUBSTEPS, GRAVITY: GRAVITY, ZONE_Y: ZONE_Y, LANE_X: LANE_X,
    POWERS: POWERS, REST: REST, SPEEDS: SPEEDS, SPEED_IDS: SPEED_IDS, POINTS: POINTS, EXTRA_AT: EXTRA_AT, BALLS: BALLS,
    WALLS: WALLS, SLINGS: SLINGS, TARGETS: TARGETS, BUMPERS: BUMPERS, LOOPS: LOOPS, FLIPPERS: FLIPPERS,
    FLIP_LEN: FLIP_LEN, FLIP_R: FLIP_R, FLIP_REST: FLIP_REST, FLIP_UP: FLIP_UP, PREVIEW_T: PREVIEW_T,
    OPTIONS: ['left', 'right', 'both', 'none'], FLIPPER_OPTIONS: ['left', 'right', 'both'], TIMINGS: TIMINGS,
    CHOICES: ['left-early', 'left-late', 'right-early', 'right-late', 'both-early', 'both-late', 'none'],
    hitPoint: hitPoint, parseChoice: parseChoice,
    createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
