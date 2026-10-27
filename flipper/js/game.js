/*
 * Flipper – spillogik og fysik (ingen DOM). Kan køres i browseren og med node.
 *
 * Motoren er fælles for alle borde. Selve bordene er data (js/borde/*.js), der
 * registreres med FlipperGame.registerTable({...}) og bygges af genbrugelige
 * dele (se PARTS herunder): vægge, buer, slynger, lysmål, bumpere, sløjfer,
 * rollover-baner, spinnere, kickout-huller, drop-mål, ramper og en ekstra
 * flipper højere oppe. Missioner og jackpot er også data.
 *
 * Alle borde er 600 × 1000 enheder og står på højkant. Fysikken regnes i faste
 * tidsskridt (STEP = 1/120 s), og hvert skridt deles i SUBSTEPS små delskridt, så
 * kuglen aldrig kan smutte igennem en væg (tunneling). Der bruges ingen
 * tilfældighed, så samme udgangspunkt altid giver præcis samme bane. Derfor kan
 * sigtelinjerne regnes med den samme fysik: det, man ser, er det, der sker.
 *
 * Øjenstyring – ingen timing og intet tidspres:
 *  - Når kuglen kommer ned i frysezonen over de nederste flippere (på vej ned) og
 *    er på vej hen til en flipper eller ud gennem midten, fryser spillet (fase
 *    'decision', state.ctx = 'lower'). Man vælger flipper ('left', 'right' eller
 *    'both') og tidspunkt ('early' = Tidligt eller 'late' = Sent) – eller 'none'.
 *  - Har bordet en øvre flipper, fryser spillet også, før kuglen kommer ned til
 *    den (state.ctx = 'upper'). Så er valgene 'upper' (med tidspunkt) og 'none'.
 *  - Tidspunktet bestemmer, hvor på flipperen kuglen rammes, og dermed retningen:
 *      Tidligt: kuglen rammes ude ved spidsen og sendes skråt over bordet.
 *      Sent:    kuglen rammes inde ved leddet og sendes næsten lige op.
 *  - Spillet fryser også, hvis kuglen ligger stille eller ruller meget langsomt
 *    ved en flipper, så man aldrig taber en kugle uden at have haft et valg.
 *  - Ligger kuglen stille et andet sted på bordet, får den et lille puf.
 *  - Der er ingen multiball: der er altid kun én kugle og ét valg ad gangen.
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
  var UPPER_REGION = 170, UPPER_REARM = 190; // den øvre flippers område (afstand til aksen)

  var SPEEDS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  factor: 0.4 },
    normal: { id: 'normal', name: 'Normal', factor: 0.6 },
    hurtig: { id: 'hurtig', name: 'Hurtig', factor: 0.85 }
  };
  var SPEED_IDS = ['rolig', 'normal', 'hurtig'];

  // Standardpoint. Et bord kan ændre dem med def.points.
  var POINTS = {
    bumper: 100, sling: 10, target: 250, targetLit: 50, loop: 500, allLights: 2000,
    rollover: 500, rolloverLit: 100, spin: 30, hole: 750, drop: 300, dropBank: 3000, ramp: 1000
  };

  // ---------- Flipperne ----------
  var FLIP_LEN = 88, FLIP_R = 9, FLIP_REST = 30, FLIP_UP = -28;
  var FLIP_HIT_T = 0.12, FLIP_UP_T = 0.35;
  var LOWER_FLIPPERS = {
    left:  { side: 'left',  x: 160, y: 896, dir: 1, len: FLIP_LEN, group: 'lower' },
    right: { side: 'right', x: 400, y: 896, dir: -1, len: FLIP_LEN, group: 'lower' }
  };

  // ---------- Genbrugelige dele til bordene ----------
  // Hver funktion giver en liste af dele, som bordene sætter sammen.
  var PARTS = {
    wall: function (ax, ay, bx, by, o) { return [Object.assign({ type: 'wall', ax: ax, ay: ay, bx: bx, by: by }, o || {})]; },
    // Bue (fx toppen): en ellipse-bue fra vinkel a0 til a1 (radianer), delt i n vægge
    arc: function (cx, cy, rx, ry, a0, a1, n, o) {
      var out = [], prev = null;
      for (var i = 0; i <= n; i++) {
        var a = a0 + (a1 - a0) * i / n, p = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
        if (prev) out.push(Object.assign({ type: 'wall', ax: prev.x, ay: prev.y, bx: p.x, by: p.y }, o || {}));
        prev = p;
      }
      return out;
    },
    // Rammen, afskydningsbanen og de skrå vægge ned mod flipperne (ens på alle borde,
    // så frysningen ved flipperne altid opfører sig ens). Ingen udløbsbaner i siderne.
    frame: function () {
      return [].concat(
        PARTS.arc(300, 200, 280, 170, Math.PI, 2 * Math.PI, 28, { r: 3, e: 0.3, part: 'top' }),
        PARTS.wall(20, 200, 20, 690),
        PARTS.wall(20, 690, 147, 882),
        PARTS.wall(580, 200, 580, 995),
        PARTS.wall(LANE_X, 250, LANE_X, 995),
        PARTS.wall(LANE_X, 690, 413, 882),
        PARTS.wall(LANE_X, 995, 580, 995, { e: 0.1 }),
        // Envejslåge øverst i afskydningsbanen (rammes kun fra spillepladens side)
        PARTS.wall(LANE_X, 250, 580, 214, { kind: 'gate', e: 0.3, nx: -0.669, ny: -0.743 })
      );
    },
    slings: function () {
      return [
        { type: 'sling', side: 'left', pts: [[80, 620], [80, 720], [140, 770]] },
        { type: 'sling', side: 'right', pts: [[480, 620], [480, 720], [420, 770]] }
      ];
    },
    // Sløjfebaner i siderne med en tragt forneden
    loopLanes: function (left, right) {
      var out = [];
      if (left !== false) out = out.concat(PARTS.wall(85, 300, 85, 430, { r: 4 }), PARTS.wall(85, 430, 112, 470, { r: 4 }));
      if (right !== false) out = out.concat(PARTS.wall(475, 300, 475, 430, { r: 4 }), PARTS.wall(475, 430, 448, 470, { r: 4 }));
      return out;
    }
  };

  // ---------- Bordene ----------
  var TABLES = {}, TABLE_IDS = [];
  function registerTable(def) {
    if (!TABLES[def.id]) TABLE_IDS.push(def.id);
    TABLES[def.id] = def;
    delete compiled[def.id];
    TABLE_IDS.sort(function (a, b) { return (TABLES[a].level || 0) - (TABLES[b].level || 0); });
    return def;
  }
  var compiled = {};
  // Bygger bordet: vægge (kapsler), bumpere, følere og så videre.
  function compile(id) {
    if (compiled[id]) return compiled[id];
    var def = TABLES[id];
    if (!def) throw new Error('Ukendt bord: ' + id);
    var t = {
      id: id, def: def, walls: [], slings: [], bumpers: [], loops: [], targets: [], rollovers: [], spinners: [],
      holes: [], drops: [], ramps: [], bank: null, points: Object.assign({}, POINTS, def.points || {}),
      flippers: { left: LOWER_FLIPPERS.left, right: LOWER_FLIPPERS.right }, sides: ['left', 'right'],
      missions: def.missions || null
    };
    function wall(p) {
      var s = { kind: p.kind || 'wall', ax: p.ax, ay: p.ay, bx: p.bx, by: p.by, r: p.r || 3, e: p.e == null ? 0.45 : p.e };
      for (var k in p) if (!(k in s) && k !== 'type') s[k] = p[k];
      t.walls.push(s);
      return s;
    }
    (def.parts || []).forEach(function (p) {
      switch (p.type) {
        case 'wall': wall(p); break;
        case 'sling':
          var q = p.pts;
          t.slings.push({ side: p.side, pts: q });
          wall({ ax: q[0][0], ay: q[0][1], bx: q[1][0], by: q[1][1], r: 4 });
          wall({ ax: q[1][0], ay: q[1][1], bx: q[2][0], by: q[2][1], r: 4 });
          wall({ ax: q[0][0], ay: q[0][1], bx: q[2][0], by: q[2][1], r: 4, kind: 'sling', side: p.side, kick: p.kick || 760, e: 0.5 });
          break;
        case 'lights': // lysmål på række – bonusbanken
          t.bank = { kind: 'lights', n: p.xs.length, name: p.name || 'Lys' };
          p.xs.forEach(function (x, i) {
            t.targets.push(wall({ ax: x - (p.w || 17), ay: p.y, bx: x + (p.w || 17), by: p.y, r: 5, kind: 'target', index: i, e: 0.5 }));
          });
          break;
        case 'rollovers': // baner øverst – bonusbanken
          t.bank = { kind: 'rollovers', n: p.xs.length, name: p.name || 'Baner', labels: p.labels || null };
          p.xs.forEach(function (x, i) { t.rollovers.push({ index: i, x: x, y: p.y, w: p.w || 16 }); });
          break;
        case 'bumper': t.bumpers.push({ x: p.x, y: p.y, r: p.r || 30, kick: p.kick || 820, name: p.name || '' }); break;
        case 'loop': t.loops.push({ side: p.side, x0: p.x0, x1: p.x1, y: p.y }); break;
        case 'spinner': t.spinners.push({ id: p.id, name: p.name || 'Spinner', x0: p.x0, x1: p.x1, y: p.y }); break;
        case 'hole': t.holes.push({ id: p.id, name: p.name || 'Hul', x: p.x, y: p.y, r: p.r || 15, cap: p.cap || 900, hold: p.hold || 0.8, eject: p.eject }); break;
        case 'drops':
          var bank = { id: p.id, name: p.name || 'Drop-mål', n: p.targets.length, targets: [] };
          p.targets.forEach(function (d, i) {
            bank.targets.push(wall({ ax: d[0], ay: d[1], bx: d[2], by: d[3], r: 6, kind: 'drop', bank: t.drops.length, index: i, e: 0.4 }));
          });
          t.drops.push(bank);
          break;
        case 'ramp':
          var ramp = { id: p.id, name: p.name || 'Rampe', sensor: p.sensor, speed: p.speed || 950, exit: p.exit || 320, rail: p.rail, walls: [] };
          (p.walls || []).forEach(function (w) { ramp.walls.push(wall({ ax: w[0], ay: w[1], bx: w[2], by: w[3], r: 4, kind: 'ramp', ramp: p.id })); });
          // Skinnens længde (kuglen køres langs skinnen med fast fart)
          var len = 0, seg = [];
          for (var i = 1; i < p.rail.length; i++) {
            var dx = p.rail[i][0] - p.rail[i - 1][0], dy = p.rail[i][1] - p.rail[i - 1][1], l = Math.sqrt(dx * dx + dy * dy);
            seg.push({ ax: p.rail[i - 1][0], ay: p.rail[i - 1][1], dx: dx, dy: dy, l: l, at: len });
            len += l;
          }
          ramp.seg = seg; ramp.len = len;
          t.ramps.push(ramp);
          break;
        default: throw new Error('Ukendt del: ' + p.type);
      }
    });
    if (def.upper) {
      t.flippers.upper = { side: 'upper', x: def.upper.x, y: def.upper.y, dir: def.upper.dir || -1, len: def.upper.len || 72, group: 'upper' };
      t.sides = ['left', 'right', 'upper'];
    }
    compiled[id] = t;
    return t;
  }

  // Flipperens vinkel (grader) set fra aksen. dir = 1: peger mod højre. Positiv vinkel = nedad.
  function angleAt(t) {
    if (t < 0) return FLIP_REST;
    if (t < 0.05) return FLIP_REST + (FLIP_UP - FLIP_REST) * (t / 0.05);
    if (t < FLIP_UP_T - 0.1) return FLIP_UP;
    if (t < FLIP_UP_T) return FLIP_UP + (FLIP_REST - FLIP_UP) * ((t - (FLIP_UP_T - 0.1)) / 0.1);
    return FLIP_REST;
  }

  // ---------- Hjælpere ----------
  // Slagpunktet på flipperen (0 = ved leddet, 1 = ude ved spidsen) ud fra kuglens
  // afstand til aksen (s, 0–1), når den kommer inden for rækkevidde, og tidspunktet.
  // Tidligt ligger altid i 0,70–1,00 og Sent i 0,10–0,35, så udfaldene er tydeligt forskellige.
  function hitPoint(s, timing) {
    s = clamp(s, 0, 1);
    return timing === 'late' ? 0.10 + 0.25 * s : 0.70 + 0.30 * s;
  }
  var OPTIONS_ALL = ['left', 'right', 'both', 'upper'];
  function parseChoice(option, timing) {
    if (typeof option !== 'string') return null;
    var m = option.split('-');
    if (m.length === 2) { option = m[0]; timing = m[1]; }
    if (option === 'none') return { option: 'none', timing: null, key: 'none' };
    if (OPTIONS_ALL.indexOf(option) < 0 || TIMINGS.indexOf(timing) < 0) return null;
    return { option: option, timing: timing, key: option + '-' + timing };
  }
  var CHOICES = {
    lower: ['left-early', 'left-late', 'right-early', 'right-late', 'both-early', 'both-late', 'none'],
    upper: ['upper-early', 'upper-late', 'none']
  };
  var FLIPPER_OPTIONS = { lower: ['left', 'right', 'both'], upper: ['upper'] };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Dyb kopi af ren data (bevarer -0, så en kopi opfører sig præcis som originalen)
  function copyData(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(copyData);
    var c = {};
    for (var k in o) c[k] = copyData(o[k]);
    return c;
  }

  function newState(tableId, speedId, gravity) {
    var t = compile(tableId);
    var drops = t.drops.map(function (b) { var a = []; for (var i = 0; i < b.n; i++) a.push(false); return a; });
    var lights = []; for (var i = 0; i < (t.bank ? t.bank.n : 0); i++) lights.push(false);
    return {
      tableId: tableId,
      speedId: SPEEDS[speedId] ? speedId : 'normal',
      gravity: gravity == null ? GRAVITY : gravity,   // kun testene ændrer den
      phase: 'launch', reason: '', ctx: 'lower',
      ball: { x: REST.x, y: REST.y, vx: 0, vy: 0 },
      score: 0, ballsLeft: BALLS, ballNo: 1, mult: 1,
      lights: lights,
      drops: drops, dropReset: t.drops.map(function () { return -1; }),
      hold: null, holeCool: 0, rail: null,
      mission: { idx: 0, n: 0, round: 1, jackpot: false },
      armed: null, decided: false, choice: null, timing: null, skipped: false,
      upperDecided: false, upperSkipped: false,
      stallT: 0, flip: { left: -1, right: -1, upper: -1 },
      time: 0, power: 3, extraIdx: 0,
      stats: { bumpers: 0, slings: 0, targets: 0, allLights: 0, loops: 0, flips: 0, freezes: 0, extra: 0, bestMult: 1,
               ramps: 0, spins: 0, holes: 0, drops: 0, dropBanks: 0, rollovers: 0, missions: 0, jackpots: 0, upperFreezes: 0 },
      events: []
    };
  }
  function cloneState(s) {
    var c = {};
    for (var k in s) c[k] = k === 'events' ? [] : copyData(s[k]);
    return c;
  }

  function createRun(opts) {
    opts = opts || {};
    var state = opts.state ? cloneState(opts.state) : newState(opts.table || TABLE_IDS[0] || 'neonbyen', opts.speedId, opts.gravity);
    var T = compile(state.tableId), P = T.points, FL = T.flippers;
    var inMission = false;

    function emit(type, data) {
      var e = { type: type, time: state.time };
      if (data) for (var k in data) e[k] = data[k];
      state.events.push(e);
      if (T.missions && !inMission) { inMission = true; mission(e); inMission = false; }
      return e;
    }
    function addPoints(base, type, data) {
      var pts = base * state.mult;
      state.score += pts;
      var e = emit(type, Object.assign({ points: pts }, data || {}));
      while (state.extraIdx < EXTRA_AT.length && state.score >= EXTRA_AT[state.extraIdx]) {
        state.extraIdx++;
        state.ballsLeft++;
        state.stats.extra++;
        emit('extra', { at: EXTRA_AT[state.extraIdx - 1] });
      }
      return e;
    }

    // ---------- Missioner og jackpot ----------
    // def.missions = { list: [{ text, short, event, id?, count, reward }], jackpot: { text, event, id?, value } }
    function matches(m, e) { return m && e.type === m.event && (m.id == null || e.id === m.id); }
    function mission(e) {
      var M = T.missions, ms = state.mission;
      if (ms.jackpot) {
        if (matches(M.jackpot, e)) {
          var v = M.jackpot.value * ms.round;
          ms.jackpot = false; ms.idx = 0; ms.n = 0; ms.round++;
          state.stats.jackpots++;
          addPoints(v / state.mult, 'jackpot', { value: v }); // jackpotten ganges ikke med bonus
        }
        return;
      }
      var m = M.list[ms.idx];
      if (!matches(m, e)) return;
      ms.n++;
      if (ms.n < m.count) { emit('progress', { n: ms.n, count: m.count }); return; }
      state.stats.missions++;
      ms.idx++; ms.n = 0;
      var done = ms.idx >= M.list.length;
      if (done && M.jackpot) ms.jackpot = true;
      else if (done) { ms.idx = 0; ms.round++; }
      addPoints(m.reward, 'mission', { text: m.text, jackpotLit: ms.jackpot });
    }

    // ---------- Kollisioner ----------
    function collideCapsule(s) {
      var b = state.ball;
      if (s.kind === 'drop' && state.drops[s.bank][s.index]) return false;
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
          addPoints(P.sling, 'sling', { side: s.side, x: qx, y: qy });
        } else if (s.kind === 'target' && -vn > 50) {
          lightUp(s.index, 'target', qx, qy);
        } else if (s.kind === 'drop' && -vn > 50 && ny > 0.3) { // kun forfra (nedefra)
          var bank = state.drops[s.bank];
          bank[s.index] = true;
          state.stats.drops++;
          addPoints(P.drop, 'drop', { id: T.drops[s.bank].id, bank: s.bank, index: s.index, x: qx, y: qy });
          if (bank.every(Boolean)) {
            state.stats.dropBanks++;
            state.dropReset[s.bank] = state.time + 1.0;
            addPoints(P.dropBank, 'dropBank', { id: T.drops[s.bank].id, bank: s.bank });
          }
        }
      }
      return true;
    }
    // Bonusbanken (lysmål eller rollover-baner): alle tændt giver point og højere bonus
    function lightUp(i, kind, x, y) {
      if (!state.lights[i]) {
        state.lights[i] = true;
        if (kind === 'target') state.stats.targets++; else state.stats.rollovers++;
        addPoints(kind === 'target' ? P.target : P.rollover, kind, { index: i, x: x, y: y });
        if (state.lights.every(Boolean)) {
          state.stats.allLights++;
          addPoints(P.allLights, 'lights', { mult: Math.min(5, state.mult + 1) });
          state.mult = Math.min(5, state.mult + 1);
          state.stats.bestMult = Math.max(state.stats.bestMult, state.mult);
          state.lights = state.lights.map(function () { return false; });
        }
      } else addPoints(kind === 'target' ? P.targetLit : P.rolloverLit, kind + 'Lit', { index: i, x: x, y: y });
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
      addPoints(P.bumper, 'bumper', { index: i, x: bp.x, y: bp.y });
    }

    // ---------- Flipperne ----------
    function flipperSegment(side) {
      var f = FL[side], a = angleAt(state.flip[side]) * Math.PI / 180;
      return { ax: f.x, ay: f.y, bx: f.x + f.dir * f.len * Math.cos(a), by: f.y + f.len * Math.sin(a), r: FLIP_R, e: 0.3, kind: 'flipper', side: side };
    }
    // Er kuglen inden for flipperens rækkevidde (området, flipperen fejer over)?
    function inReach(side) {
      var f = FL[side], b = state.ball;
      if (!f) return -1;
      var rx = (b.x - f.x) * f.dir, ry = b.y - f.y;
      var dist = Math.sqrt(rx * rx + ry * ry);
      if (dist > f.len + R - 1) return -1;
      var ang = Math.atan2(ry, rx) * 180 / Math.PI;
      if (ang < FLIP_UP - 12 || ang > FLIP_REST + 8) return -1;
      return clamp(dist / f.len, 0, 1);
    }
    function fire(side, s, timing) {
      var f = FL[side], b = state.ball, h = hitPoint(s, timing);
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
      var b = state.ball, sides = T.sides, i;
      for (i = 0; i < sides.length; i++) {
        var sd = sides[i];
        if (state.flip[sd] >= 0) { state.flip[sd] += dt; if (state.flip[sd] >= FLIP_UP_T) state.flip[sd] = -1; }
      }
      b.vy += state.gravity * dt;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
      var px = b.x, py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // To runder, så hjørner opfører sig pænt
      for (var it = 0; it < 2; it++) {
        for (i = 0; i < T.walls.length; i++) collideCapsule(T.walls[i]);
        for (i = 0; i < sides.length; i++) {
          var ft = state.flip[sides[i]];
          if (ft >= 0 && ft < FLIP_HIT_T) continue; // kuglen er lige slået væk
          collideCapsule(flipperSegment(sides[i]));
        }
      }
      for (var j = 0; j < T.bumpers.length; j++) collideBumper(T.bumpers[j], j);
      // Sløjfer
      for (var k = 0; k < T.loops.length; k++) {
        var lp = T.loops[k];
        if (py > lp.y && b.y <= lp.y && b.x > lp.x0 && b.x < lp.x1 && b.vy < 0) {
          state.stats.loops++;
          addPoints(P.loop, 'loop', { side: lp.side, x: b.x, y: lp.y });
        }
      }
      // Rollover-baner: kuglen ruller over føleren (op eller ned)
      for (k = 0; k < T.rollovers.length; k++) {
        var ro = T.rollovers[k];
        if ((py - ro.y) * (b.y - ro.y) < 0 && Math.abs(b.x - ro.x) < ro.w) lightUp(ro.index, 'rollover', ro.x, ro.y);
      }
      // Spinnere: fart gennem føleren giver flere omgange
      for (k = 0; k < T.spinners.length; k++) {
        var spn = T.spinners[k];
        if ((py - spn.y) * (b.y - spn.y) < 0 && b.x > spn.x0 && b.x < spn.x1) {
          var spins = clamp(Math.round(Math.abs(b.vy) / 120), 1, 15);
          state.stats.spins += spins;
          b.vx *= 0.94; b.vy *= 0.94;
          addPoints(P.spin * spins, 'spinner', { id: spn.id, index: k, spins: spins, x: b.x, y: spn.y });
        }
      }
      // Ramper: kuglen kører op over føleren og op på skinnen
      for (k = 0; k < T.ramps.length; k++) {
        var rp = T.ramps[k], sn = rp.sensor;
        if (!state.rail && py > sn.y && b.y <= sn.y && b.x > sn.x0 && b.x < sn.x1 && b.vy < 0) {
          state.rail = { i: k, d: 0 };
          b.x = rp.rail[0][0]; b.y = rp.rail[0][1]; b.vx = 0; b.vy = 0;
          state.stats.ramps++;
          addPoints(P.ramp, 'ramp', { id: rp.id, index: k, x: b.x, y: b.y });
          return 'rail';
        }
      }
      // Kickout-huller: en rolig kugle fanges et øjeblik og skydes ud igen
      if (state.holeCool <= 0) {
        for (k = 0; k < T.holes.length; k++) {
          var ho = T.holes[k], hx = b.x - ho.x, hy = b.y - ho.y;
          if (hx * hx + hy * hy < ho.r * ho.r && sp < ho.cap) {
            state.hold = { i: k, t: 0 };
            b.x = ho.x; b.y = ho.y; b.vx = 0; b.vy = 0;
            state.stats.holes++;
            addPoints(P.hole, 'hole', { id: ho.id, index: k, x: ho.x, y: ho.y });
            return 'hold';
          }
        }
      }
      // Ladede flippere slår selv, når kuglen er inden for rækkevidde
      if (state.armed) {
        var tl = state.armed.left ? inReach('left') : -1;
        var tr = state.armed.right ? inReach('right') : -1;
        var tu = state.armed.upper ? inReach('upper') : -1;
        if (tl >= 0 && (tr < 0 || b.x <= 280)) fire('left', tl, state.armed.timing);
        else if (tr >= 0) fire('right', tr, state.armed.timing);
        else if (tu >= 0) fire('upper', tu, state.armed.timing);
      }
      state.time += dt;
      return '';
    }

    function inZone() { var b = state.ball; return b.y > ZONE_Y && b.x < LANE_X; }
    function freeze(reason, ctx) {
      state.phase = 'decision';
      state.reason = reason;
      state.ctx = ctx || 'lower';
      state.armed = null;
      state.stallT = 0;
      state.stats.freezes++;
      if (ctx === 'upper') state.stats.upperFreezes++;
      emit('freeze', { reason: reason, ctx: state.ctx });
    }
    function nudge(toDrain) {
      var b = state.ball;
      if (toDrain) { b.vx += b.x < 280 ? 120 : -120; b.vy += 60; }
      else { b.vx = b.x < 280 ? 150 : -150; b.vy = -320; }
      state.stallT = 0;
      emit('nudge', { toDrain: !!toDrain });
    }
    function upperDist() {
      var f = FL.upper, b = state.ball;
      if (!f) return Infinity;
      var dx = b.x - f.x, dy = b.y - f.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Kuglen på en rampeskinne: køres med fast fart og slippes for enden
    function railStep() {
      var rp = T.ramps[state.rail.i], b = state.ball;
      state.rail.d += rp.speed * STEP;
      state.time += STEP;
      var d = Math.min(state.rail.d, rp.len), sg = rp.seg[rp.seg.length - 1];
      for (var i = 0; i < rp.seg.length; i++) if (d <= rp.seg[i].at + rp.seg[i].l) { sg = rp.seg[i]; break; }
      var f = sg.l > 0 ? (d - sg.at) / sg.l : 1;
      b.x = sg.ax + sg.dx * f; b.y = sg.ay + sg.dy * f;
      if (state.rail.d >= rp.len) {
        b.vx = sg.dx / sg.l * rp.exit; b.vy = sg.dy / sg.l * rp.exit;
        state.rail = null;
        emit('rampEnd', { id: rp.id, index: T.ramps.indexOf(rp) });
      }
      state.stallT = 0;
    }
    // Kuglen ligger i et kickout-hul
    function holdStep() {
      var ho = T.holes[state.hold.i], b = state.ball;
      state.hold.t += STEP;
      state.time += STEP;
      if (state.hold.t >= ho.hold) {
        b.vx = ho.eject[0]; b.vy = ho.eject[1];
        state.hold = null;
        state.holeCool = 0.4;
        emit('eject', { id: ho.id });
      }
      state.stallT = 0;
    }

    // ---------- Ét fast tidsskridt (1/120 s) ----------
    function step() {
      if (state.phase !== 'rolling') return state.phase;
      if (state.holeCool > 0) state.holeCool -= STEP;
      for (var di = 0; di < state.dropReset.length; di++) {
        if (state.dropReset[di] >= 0 && state.time >= state.dropReset[di] && !nearDrops(di)) {
          state.dropReset[di] = -1;
          state.drops[di] = state.drops[di].map(function () { return false; });
          emit('dropReset', { bank: di });
        }
      }
      if (state.rail) { railStep(); return state.phase; }
      if (state.hold) { holdStep(); return state.phase; }
      var dt = STEP / SUBSTEPS;
      for (var i = 0; i < SUBSTEPS; i++) {
        if (substep(dt)) break;
      }
      var b = state.ball;
      // Tabt kugle (gennem midten)
      if (b.y > H + R * 2) {
        state.ballsLeft--;
        state.mult = 1;
        state.phase = 'lost';
        state.armed = null; state.decided = false; state.upperDecided = false;
        emit('drain', { last: state.ballsLeft <= 0 });
        return state.phase;
      }
      // Kuglen faldt tilbage i afskydningsbanen: skyd igen
      if (b.x > LANE_X && b.y >= REST.y - 1 && b.vy >= 0) {
        resetBall();
        emit('return');
        return state.phase;
      }
      if (state.rail || state.hold) return state.phase;
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      state.stallT = speed < STALL_V ? state.stallT + STEP : 0;
      if (inZone()) {
        if (b.vy < -REARM_V) { state.decided = false; state.skipped = false; if (state.armed && !state.armed.upper) state.armed = null; }
        if (!state.decided && !state.skipped && b.vy > 0) {
          if (needsChoice()) { freeze('zone', 'lower'); return state.phase; }
          state.skipped = true;
        }
        if (state.stallT >= STALL_ZONE_T) {
          if (!state.decided) { freeze('stille', 'lower'); return state.phase; }
          nudge(true);
        }
      } else {
        if (b.y <= ZONE_Y) { state.decided = false; state.skipped = false; if (state.armed && !state.armed.upper) state.armed = null; }
        // Den øvre flipper: frys, før kuglen kommer ned til den
        if (FL.upper) {
          var ud = upperDist();
          if (ud > UPPER_REARM || b.vy < -REARM_V) {
            state.upperDecided = false; state.upperSkipped = false;
            if (state.armed && state.armed.upper) state.armed = null;
          } else if (!state.upperDecided && !state.upperSkipped && b.vy > 0 && ud < UPPER_REGION) {
            if (upperNeedsChoice()) { freeze('zone', 'upper'); return state.phase; }
            state.upperSkipped = true;
          }
          if (state.stallT >= STALL_ZONE_T && inReach('upper') >= 0) {
            if (!state.upperDecided) { freeze('stille', 'upper'); return state.phase; }
            nudge(false); return state.phase;
          }
        }
        if (state.stallT >= STALL_TABLE_T && b.x < LANE_X) nudge(false);
      }
      return state.phase;
    }
    function nearDrops(bi) {
      var b = state.ball;
      return T.drops[bi].targets.some(function (w) {
        var mx = (w.ax + w.bx) / 2, my = (w.ay + w.by) / 2, dx = b.x - mx, dy = b.y - my;
        return dx * dx + dy * dy < 70 * 70;
      });
    }

    // Skal spilleren vælge nu? Kuglen følges (med samme fysik) uden at gøre noget:
    // Kommer den inden for en flippers rækkevidde, går den tabt, eller ligger den
    // stille, så fryser spillet. Ruller den i stedet op og ud af zonen igen (fx fra
    // en skrå væg eller en slynge), er der intet at vælge, og spillet kører videre.
    function needsChoice() {
      var copy = createRun({ state: state });
      var cs = copy.state;
      cs.skipped = true; cs.decided = false; cs.armed = null; cs.upperSkipped = true;
      for (var i = 0; i < 480; i++) {
        if (copy.inReach('left') >= 0 || copy.inReach('right') >= 0) return true;
        copy.step();
        if (cs.phase !== 'rolling') return cs.phase !== 'launch';
        if (cs.ball.y <= ZONE_Y || cs.ball.vy < -REARM_V) return false;
      }
      return true;
    }
    // Den øvre flipper: når kuglen dens rækkevidde, før den forlader området igen?
    function upperNeedsChoice() {
      var copy = createRun({ state: state });
      var cs = copy.state;
      cs.upperSkipped = true; cs.upperDecided = false; cs.armed = null; cs.skipped = true;
      for (var i = 0; i < 480; i++) {
        if (copy.inReach('upper') >= 0) return true;
        copy.step();
        if (cs.phase !== 'rolling') return false;
        if (copy.upperDist() > UPPER_REARM || cs.ball.vy < -REARM_V) return false;
      }
      return false;
    }

    function resetBall() {
      state.ball = { x: REST.x, y: REST.y, vx: 0, vy: 0 };
      state.phase = 'launch';
      state.reason = ''; state.ctx = 'lower';
      state.armed = null; state.decided = false; state.skipped = false; state.stallT = 0;
      state.upperDecided = false; state.upperSkipped = false;
      state.rail = null; state.hold = null;
      state.flip = { left: -1, right: -1, upper: -1 };
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
    // Hvilke valg findes i dette frosne øjeblik?
    function choices() { return state.phase === 'decision' ? CHOICES[state.ctx].slice() : []; }
    function flipperOptions() { return FLIPPER_OPTIONS[state.ctx].slice(); }
    // choose('left', 'early') eller choose('left-early'); 'none' kræver intet tidspunkt.
    function choose(option, timing) {
      if (state.phase !== 'decision') return false;
      var c = parseChoice(option, timing);
      if (!c || CHOICES[state.ctx].indexOf(c.key) < 0) return false;
      option = c.option; timing = c.timing;
      var wasStill = state.reason === 'stille';
      state.phase = 'rolling';
      if (state.ctx === 'upper') state.upperDecided = true; else state.decided = true;
      state.choice = option;
      state.timing = timing;
      state.armed = option === 'none' ? null
        : option === 'upper' ? { left: false, right: false, upper: true, timing: timing }
        : { left: option !== 'right', right: option !== 'left', upper: false, timing: timing };
      state.stallT = 0;
      emit('choose', { option: option, timing: timing, ctx: state.ctx });
      if (option === 'none' && wasStill) { if (state.ctx === 'upper') nudge(false); else nudge(true); }
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
      if (!c || CHOICES[state.ctx].indexOf(c.key) < 0) return null;
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
      get state() { return state; }, table: T,
      step: step, shoot: shoot, setPower: setPower, choose: choose, nextBall: nextBall, choices: choices, flipperOptions: flipperOptions,
      preview: preview, previewLaunch: previewLaunch, canReach: canReach, drainEvents: drainEvents,
      inZone: inZone, inReach: inReach, upperDist: upperDist, flipperSegment: flipperSegment,
      flipperAngle: function (side) { return angleAt(state.flip[side]); },
      // Kun til test
      _place: function (x, y, vx, vy) {
        state.ball = { x: x, y: y, vx: vx || 0, vy: vy || 0 }; state.phase = 'rolling';
        state.decided = false; state.skipped = false; state.upperDecided = false; state.upperSkipped = false;
        state.armed = null; state.stallT = 0; state.rail = null; state.hold = null;
      }
    };
  }

  // Missionsstatus til skærmen: { title, text, short, n, count, jackpot } eller null
  function missionStatus(state) {
    var t = compile(state.tableId), M = t.missions;
    if (!M) return null;
    var ms = state.mission;
    if (ms.jackpot) return { jackpot: true, text: M.jackpot.text, short: M.jackpot.short || 'Jackpot', value: M.jackpot.value * ms.round, step: M.list.length, steps: M.list.length };
    var m = M.list[ms.idx];
    return { jackpot: false, text: m.text, short: m.short || m.text, n: ms.n, count: m.count, step: ms.idx + 1, steps: M.list.length, reward: m.reward };
  }

  global.FlipperGame = {
    W: W, H: H, R: R, STEP: STEP, SUBSTEPS: SUBSTEPS, GRAVITY: GRAVITY, ZONE_Y: ZONE_Y, LANE_X: LANE_X,
    POWERS: POWERS, REST: REST, SPEEDS: SPEEDS, SPEED_IDS: SPEED_IDS, POINTS: POINTS, EXTRA_AT: EXTRA_AT, BALLS: BALLS,
    FLIPPERS: LOWER_FLIPPERS, FLIP_LEN: FLIP_LEN, FLIP_R: FLIP_R, FLIP_REST: FLIP_REST, FLIP_UP: FLIP_UP, PREVIEW_T: PREVIEW_T,
    UPPER_REGION: UPPER_REGION, UPPER_REARM: UPPER_REARM,
    OPTIONS: ['left', 'right', 'both', 'none'], FLIPPER_OPTIONS: FLIPPER_OPTIONS.lower, TIMINGS: TIMINGS,
    CHOICES: CHOICES.lower, CHOICES_BY_CTX: CHOICES, FLIPPER_OPTIONS_BY_CTX: FLIPPER_OPTIONS,
    PARTS: PARTS, TABLES: TABLES, TABLE_IDS: TABLE_IDS, registerTable: registerTable, table: compile,
    hitPoint: hitPoint, parseChoice: parseChoice, missionStatus: missionStatus,
    createRun: createRun
  };
  // Det første bords dele som faste navne (bruges af ældre kode og tests)
  ['WALLS:walls', 'SLINGS:slings', 'TARGETS:targets', 'BUMPERS:bumpers', 'LOOPS:loops'].forEach(function (kv) {
    var p = kv.split(':');
    Object.defineProperty(global.FlipperGame, p[0], { enumerable: true, get: function () { return compile(TABLE_IDS[0])[p[1]]; } });
  });
})(typeof window !== 'undefined' ? window : globalThis);
