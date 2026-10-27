/*
 * Golf – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og tegner
 * banen på et canvas. Kender ingen farver, streger, glød eller skygger: alle
 * værdier læses som CSS-variabler (--golf-<navn>) via getComputedStyle, og alle
 * figurer tegnes af temaets navngivne tegnefunktioner (window.GolfTema.tegn).
 *
 * Banen er altid 1000 × 600 enheder i logikken. Er pladsen på skærmen højere
 * end bred (højkant), drejes tegningen en kvart omgang mod uret, så starten
 * ligger nederst. Drejningen bevarer omløbsretningen, så "med uret" er det
 * samme på skærmen i begge tilfælde.
 */
(function (global) {
  'use strict';
  var T = global.GolfTema;
  var L = global.GolfLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;

  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('golf-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'golf-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'golf-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="golf-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#golf-ikon-' + navn + '"' + (cls ? ' class="' + cls + '"' : '') + '/></svg>';
  }
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  // Temaets værdier fra CSS
  var style = null;
  function readStyle() {
    var cs = getComputedStyle(root), s = {};
    T.farver.forEach(function (n) { s[n] = cs.getPropertyValue('--golf-' + n).trim() || 'transparent'; });
    T.tal.forEach(function (n) { var v = parseFloat(cs.getPropertyValue('--golf-' + n)); s[n] = isNaN(v) ? 0 : v; });
    style = s;
    return s;
  }

  // Tegner hele banen i banens enheder (ctx er allerede transformeret)
  function drawCourse(ctx, hole, s) {
    var b = { W: L.W, H: L.H }, t = T.tegn;
    t.flade(ctx, b, s);
    hole.skraaning.forEach(function (z) { t.skraaning(ctx, z, s); });
    hole.sand.forEach(function (z) { t.sand(ctx, z, s); });
    hole.vand.forEach(function (z) { t.vand(ctx, z, s); });
    t.tee(ctx, hole.tee, s);
    t.hul(ctx, { x: hole.hul.x, y: hole.hul.y, r: L.RULES.holeR }, s);
    hole.vaegge.forEach(function (w) { if (!w.kant) t.bande(ctx, w, s); });
    t.kant(ctx, b, s);
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 0, cssH = 0, rotated = false, ccw = true, scale = 1, pad = 0, dpr = 1;
    var anim = null;   // { path, start, dur, onDone }
    var last = null;   // sidst tegnede tilstand og visning
    function resize(w, h) {
      dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      cssW = w; cssH = h;
      rotated = h > w * 1.05;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var bw = rotated ? L.H : L.W, bh = rotated ? L.W : L.H;
      // Kanten tegnes uden for banen: plads til den (og til gløden)
      pad = (style ? style['kant-w'] : 8) + (style ? style['kontur-w'] : 0) + 2;
      scale = Math.min(w / (bw + 2 * pad), h / (bh + 2 * pad));
      if (last) draw(last.state, last.view);
    }
    // Banens enheder → skærmens px (inde i canvas)
    function setTransform() {
      var bw = rotated ? L.H : L.W, bh = rotated ? L.W : L.H;
      var ox = (cssW - bw * scale) / 2, oy = (cssH - bh * scale) / 2;
      var k = scale * dpr;
      if (!rotated) ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
      // På højkant drejes banen, så tee'en altid er nederst:
      // mod uret (tee til venstre): (x, y) → (y, W − x); med uret (tee til højre): (x, y) → (H − y, x)
      else if (ccw) ctx.setTransform(0, -k, k, 0, ox * dpr, (oy + L.W * scale) * dpr);
      else ctx.setTransform(0, k, -k, 0, (ox + L.H * scale) * dpr, oy * dpr);
    }
    function toWorld(px, py) {
      var bw = rotated ? L.H : L.W, bh = rotated ? L.W : L.H;
      var ox = (cssW - bw * scale) / 2, oy = (cssH - bh * scale) / 2;
      var u = (px - ox) / scale, v = (py - oy) / scale;
      if (!rotated) return { x: u, y: v };
      return ccw ? { x: L.W - v, y: u } : { x: v, y: L.H - u };
    }
    // view: { preview: {pts, full}, endMarker: {x,y}, ball: {x,y} (under animation), trail }
    function draw(state, view) {
      last = { state: state, view: view || {} };
      view = last.view;
      if (!style) readStyle();
      var s = style, hole = state.hole;
      ccw = hole.tee.x <= L.W / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTransform();
      drawCourse(ctx, hole, s);
      if (view.trail) T.tegn.spor(ctx, view.trail, s);
      if (view.preview) T.tegn.sigte(ctx, view.preview, s);
      if (view.endMarker) T.tegn.slutpunkt(ctx, { x: view.endMarker.x, y: view.endMarker.y, r: L.RULES.ballR }, s);
      var ball = view.ball || state.ball;
      var inHole = state.holed && !view.ball;
      if (!inHole) T.tegn.bold(ctx, { x: ball.x, y: ball.y, r: L.RULES.ballR }, s);
      // Flaget står altid lodret på skærmen (også når banen er drejet)
      if (rotated) {
        ctx.save(); ctx.translate(hole.hul.x, hole.hul.y); ctx.rotate(ccw ? Math.PI / 2 : -Math.PI / 2);
        T.tegn.flag(ctx, { x: 0, y: 0, r: L.RULES.holeR }, s);
        ctx.restore();
      } else T.tegn.flag(ctx, { x: hole.hul.x, y: hole.hul.y, r: L.RULES.holeR }, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // Bolden ruller langs banen. speed > 1 er hurtigere end virkelig tid.
    function animate(state, path, opts) {
      stop();
      var dur = Math.max(0.3, path[path.length - 1].t / (opts.speed || 1)) * 1000;
      var raf = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
      var i = 0;
      anim = { done: opts.onDone, id: 0 };
      var t0 = null;
      function frame(now) {
        if (!anim) return;
        if (t0 === null) t0 = now;
        var tt = Math.min(1, (now - t0) / dur) * path[path.length - 1].t;
        while (i < path.length - 2 && path[i + 1].t < tt) i++;
        var a = path[i], b = path[Math.min(path.length - 1, i + 1)], f = b.t > a.t ? (tt - a.t) / (b.t - a.t) : 1;
        f = Math.max(0, Math.min(1, f));
        var p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        var trail = path.slice(0, i + 1).concat([p]);
        draw(state, { ball: p, trail: trail });
        if (tt >= path[path.length - 1].t) { var cb = anim.done; anim = null; if (cb) cb(); return; }
        anim.id = raf(frame);
      }
      anim.id = raf(frame);
    }
    function stop() {
      if (!anim) return;
      var caf = global.cancelAnimationFrame || clearTimeout;
      caf(anim.id); anim = null;
    }
    // Skærmens vinkel (0° = op, med uret) for en vinkel i banen (0° = mod højre)
    function screenAngle(a) { return L.normAngle(a + (rotated ? (ccw ? 0 : 180) : 90)); }
    return {
      resize: resize, draw: draw, animate: animate, stop: stop, toWorld: toWorld, screenAngle: screenAngle,
      restyle: function () { readStyle(); if (cssW) resize(cssW, cssH); },
      get rotated() { return rotated; },
      get animating() { return !!anim; },
      get scale() { return scale; }
    };
  }

  // Lille stillbillede af et hul (startmenu, Hul klaret og game over)
  function mini(canvas, hole, ball, opts) {
    opts = opts || {};
    var r = canvas.getBoundingClientRect();
    var w = Math.max(40, Math.round(r.width || canvas.clientWidth || 300)), h = Math.max(30, Math.round(r.height || canvas.clientHeight || 180));
    var dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d'), s = style || readStyle();
    var pad = s['kant-w'] + s['kontur-w'] + 2;
    var k = Math.min(w / (L.W + 2 * pad), h / (L.H + 2 * pad));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, (w - L.W * k) / 2 * dpr, (h - L.H * k) / 2 * dpr);
    drawCourse(ctx, hole, s);
    if (opts.trail) T.tegn.spor(ctx, opts.trail, s);
    if (opts.preview) T.tegn.sigte(ctx, opts.preview, s);
    if (ball) T.tegn.bold(ctx, { x: ball.x, y: ball.y, r: L.RULES.ballR }, s);
    T.tegn.flag(ctx, { x: hole.hul.x, y: hole.hul.y, r: L.RULES.holeR }, s);
  }

  global.GolfTegn = { create: create, installerIkoner: installerIkoner, ikon: ikon, cssNum: cssNum, readStyle: readStyle, mini: mini };
})(typeof window !== 'undefined' ? window : globalThis);
