/*
 * Billard – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og tegner
 * bordet på et canvas. Kender ingen farver, streger, glød, skygger eller
 * skrifttyper: alle værdier læses som CSS-variabler (--billard-<navn>) via
 * getComputedStyle, og alle figurer tegnes af temaets navngivne tegnefunktioner
 * (window.BillardTema.tegn).
 *
 * Spillefladen er 1000 × 500 enheder, og rammen (M = 60) ligger uden om. Er
 * pladsen på skærmen højere end bred (højkant), drejes bordet en kvart omgang
 * mod uret, så bagfeltet (hvor man slår op fra) ligger nederst. Drejningen
 * bevarer omløbsretningen, så "med uret" er det samme på skærmen i begge tilfælde.
 */
(function (global) {
  'use strict';
  var T = global.BillardTema;
  var L = global.BillardLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var M = 60;                       // rammen uden om spillefladen (bordets enheder)
  var OW = L.W + 2 * M, OH = L.H + 2 * M;

  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('billard-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'billard-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'billard-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="billard-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  // Temaets værdier fra CSS
  var style = null;
  function readStyle() {
    var cs = getComputedStyle(root), s = {};
    T.farver.forEach(function (n) { s[n] = cs.getPropertyValue('--billard-' + n).trim() || 'transparent'; });
    (T.tekster || []).forEach(function (n) { s[n] = cs.getPropertyValue('--billard-' + n).trim() || 'sans-serif'; });
    T.tal.forEach(function (n) { var v = parseFloat(cs.getPropertyValue('--billard-' + n)); s[n] = isNaN(v) ? 0 : v; });
    style = s;
    return s;
  }
  function typeOf(id) { var g = L.groupOf(id); return g === 'otte' ? 'otte' : g; }

  // Bordet uden kugler (i bordets enheder; ctx er allerede transformeret)
  function drawTable(ctx, s) {
    var t = T.tegn, b = { W: L.W, H: L.H, M: M, head: L.RULES.headSpot, foot: L.RULES.footSpot, mc: L.RULES.mouthCorner, mm: L.RULES.mouthMiddle };
    t.bord(ctx, b, s);
    t.filt(ctx, b, s);
    L.POCKETS.forEach(function (p) { t.hul(ctx, { x: p.x, y: p.y, r: p.r, kind: p.kind }, s); });
    t.bande(ctx, b, s);
  }
  // pos: liste af { id, x, y } for kuglerne på bordet
  function drawBalls(ctx, s, pos, rot) {
    pos.forEach(function (b) {
      T.tegn.kugle(ctx, { x: b.x, y: b.y, r: L.R, nr: b.id, type: typeOf(b.id), rot: rot }, s);
    });
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 0, cssH = 0, rotated = false, scale = 1, dpr = 1;
    var anim = null, last = null;
    function resize(w, h) {
      dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      cssW = w; cssH = h;
      rotated = h > w * 1.05;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var bw = rotated ? OH : OW, bh = rotated ? OW : OH;
      scale = Math.min(w / bw, h / bh);
      if (last) draw(last.state, last.view);
    }
    function offsets() {
      var bw = rotated ? OH : OW, bh = rotated ? OW : OH;
      return { ox: (cssW - bw * scale) / 2, oy: (cssH - bh * scale) / 2 };
    }
    // Bordets enheder → skærmens px (inde i canvas)
    function setTransform() {
      var o = offsets(), k = scale * dpr;
      if (!rotated) ctx.setTransform(k, 0, 0, k, (o.ox + M * scale) * dpr, (o.oy + M * scale) * dpr);
      // Højkant: mod uret, (x, y) → (y, W − x), så bagfeltet er nederst
      else ctx.setTransform(0, -k, k, 0, (o.ox + M * scale) * dpr, (o.oy + (L.W + M) * scale) * dpr);
    }
    function toWorld(px, py) {
      var o = offsets(), u = (px - o.ox) / scale - M, v = (py - o.oy) / scale - M;
      if (!rotated) return { x: u, y: v };
      return { x: L.W - v, y: u };
    }
    function toScreen(x, y) {
      var o = offsets();
      if (!rotated) return { x: o.ox + (x + M) * scale, y: o.oy + (y + M) * scale };
      return { x: o.ox + (y + M) * scale, y: o.oy + (L.W + M - x) * scale };
    }
    // view: { preview, cue: {aim, power}, targets: [id], hand: bool, pos: [{id,x,y}] (under animation) }
    function draw(state, view) {
      last = { state: state, view: view || {} };
      view = last.view;
      if (!style) readStyle();
      var s = style, rot = rotated ? Math.PI / 2 : 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTransform();
      drawTable(ctx, s);
      var pos = view.pos || state.balls.filter(function (b) { return b.in; });
      var cue = null;
      pos.forEach(function (b) { if (b.id === 0) cue = b; });
      if (view.targets) view.targets.forEach(function (id) {
        var b = L.ballById(state.balls, id);
        if (b && b.in) T.tegn.maal(ctx, { x: b.x, y: b.y, r: L.R }, s);
      });
      if (view.preview) T.tegn.sigte(ctx, Object.assign({ r: L.R }, view.preview), s);
      drawBalls(ctx, s, pos, rot);
      if (cue && view.hand) T.tegn.haand(ctx, { x: cue.x, y: cue.y, r: L.R }, s);
      if (cue && view.cue) T.tegn.koe(ctx, { x: cue.x, y: cue.y, r: L.R, aim: view.cue.aim, power: view.cue.power }, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // Kuglerne ruller efter simuleringen. speed > 1 er hurtigere end virkelig tid.
    function animate(state, sim, ids, opts) {
      stop();
      var frames = sim.frames, T1 = frames[frames.length - 1].t;
      var dur = Math.max(0.3, T1 / (opts.speed || 1)) * 1000;
      var raf = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
      var i = 0, t0 = null;
      anim = { done: opts.onDone, id: 0 };
      function frame(now) {
        if (!anim) return;
        if (t0 === null) t0 = now;
        var tt = Math.min(1, (now - t0) / dur) * T1;
        while (i < frames.length - 2 && frames[i + 1].t < tt) i++;
        var a = frames[i], b = frames[Math.min(frames.length - 1, i + 1)];
        var f = b.t > a.t ? Math.max(0, Math.min(1, (tt - a.t) / (b.t - a.t))) : 1;
        var pos = [];
        for (var k = 0; k < ids.length; k++) {
          var ax = a.p[2 * k], bx = b.p[2 * k];
          if (isNaN(ax)) continue;
          if (isNaN(bx)) { pos.push({ id: ids[k], x: ax, y: a.p[2 * k + 1] }); continue; }
          pos.push({ id: ids[k], x: ax + (bx - ax) * f, y: a.p[2 * k + 1] + (b.p[2 * k + 1] - a.p[2 * k + 1]) * f });
        }
        draw(state, { pos: pos });
        if (tt >= T1) { var cb = anim.done; anim = null; if (cb) cb(); return; }
        anim.id = raf(frame);
      }
      anim.id = raf(frame);
    }
    function stop() {
      if (!anim) return;
      var caf = global.cancelAnimationFrame || clearTimeout;
      caf(anim.id); anim = null;
    }
    // Skærmens vinkel (0° = op, med uret) for en vinkel på bordet (0° = mod højre)
    function screenAngle(a) { return L.normAngle(a + (rotated ? 0 : 90)); }
    return {
      resize: resize, draw: draw, animate: animate, stop: stop, toWorld: toWorld, toScreen: toScreen, screenAngle: screenAngle,
      restyle: function () { readStyle(); if (cssW) resize(cssW, cssH); },
      get rotated() { return rotated; },
      get animating() { return !!anim; },
      get scale() { return scale; }
    };
  }

  // Lille stillbillede af bordet (startmenu, parti vundet og game over)
  function mini(canvas, balls, opts) {
    opts = opts || {};
    var r = canvas.getBoundingClientRect();
    var w = Math.max(40, Math.round(r.width || canvas.clientWidth || 300)), h = Math.max(30, Math.round(r.height || canvas.clientHeight || 160));
    var dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d'), s = style || readStyle();
    var k = Math.min(w / OW, h / OH);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, ((w - OW * k) / 2 + M * k) * dpr, ((h - OH * k) / 2 + M * k) * dpr);
    drawTable(ctx, s);
    var pos = balls.filter(function (b) { return b.in; });
    if (opts.preview) T.tegn.sigte(ctx, Object.assign({ r: L.R }, opts.preview), s);
    drawBalls(ctx, s, pos, 0);
    var cue = L.ballById(balls, 0);
    if (opts.cue && cue && cue.in) T.tegn.koe(ctx, { x: cue.x, y: cue.y, r: L.R, aim: opts.cue.aim, power: opts.cue.power }, s);
  }

  global.BillardTegn = { create: create, installerIkoner: installerIkoner, readStyle: readStyle, mini: mini, M: M, OW: OW, OH: OH };
})(typeof window !== 'undefined' ? window : globalThis);
