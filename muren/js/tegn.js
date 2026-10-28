/*
 * Muren – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og tegner
 * brættet på et canvas. Kender ingen farver, streger, glød, skygger eller
 * skrifttyper: alle værdier læses som CSS-variabler (--muren-<navn>) via
 * getComputedStyle, og alle figurer tegnes af temaets navngivne tegnefunktioner
 * (window.MurenTema.tegn).
 *
 * Brættet er 700 × 1000 enheder og står altid på højkant (kanonen nederst).
 */
(function (global) {
  'use strict';
  var T = global.MurenTema;
  var L = global.MurenLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;

  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('muren-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'muren-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'muren-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="muren-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }

  // Temaets værdier fra CSS
  var style = null;
  function readStyle() {
    var cs = getComputedStyle(root), s = {};
    T.farver.forEach(function (n) { s[n] = cs.getPropertyValue('--muren-' + n).trim() || 'transparent'; });
    (T.tekster || []).forEach(function (n) { s[n] = cs.getPropertyValue('--muren-' + n).trim(); });
    T.tal.forEach(function (n) { var v = parseFloat(cs.getPropertyValue('--muren-' + n)); s[n] = isNaN(v) ? 0 : v; });
    style = s;
    return s;
  }

  // Stenens styrke (0–4) i forhold til turen: jo højere tal, jo stærkere farve
  function tone(n, turn) {
    var f = n / Math.max(1, turn * 2);
    return Math.max(0, Math.min(4, Math.floor(f * 5)));
  }

  // Tegner hele brættet i brættets enheder (ctx er allerede transformeret)
  function drawBoard(ctx, state, view, s) {
    var t = T.tegn, R = L.RULES.ballR, H = L.H;
    view = view || {};
    t.flade(ctx, { W: L.W, H: L.H, cell: L.CELL }, s);
    t.bundlinje(ctx, { W: L.W, H: L.H, y: (L.ROWS - 1) * L.CELL }, s);
    state.rings.forEach(function (o) { t.ring(ctx, L.ringPos(o), s); });
    state.bricks.forEach(function (b) {
      var q = L.brickRect(b);
      t.sten(ctx, { x: q.x, y: q.y, w: q.w, h: q.h, n: b.n, tone: tone(b.n, state.turn) }, s);
    });
    var v = state.volley;
    if (view.preview && !v) {
      t.sigte(ctx, { pts: view.preview.pts }, s);
      if (view.preview.first) t.traef(ctx, { x: view.preview.first.x, y: view.preview.first.y, r: R }, s);
    }
    var ox = state.originX;
    if (v) {
      var waiting = v.balls.length - v.launched;
      if (v.firstX !== null) t.landing(ctx, { x: v.firstX, y: H, r: R }, s);
      t.kanon(ctx, { x: ox, y: H - R, a: state.aim, r: R }, s);
      v.balls.forEach(function (b) {
        if (b.st === 1) t.kugle(ctx, { x: b.x, y: b.y, r: R }, s);
        else if (b.st === 2) t.kugle(ctx, { x: v.firstX, y: H - R, r: R }, s);
      });
      if (waiting > 0) t.antal(ctx, { x: ox, y: H - 4.6 * R - 22, n: waiting }, s);
    } else {
      t.kanon(ctx, { x: ox, y: H - R, a: state.aim, r: R }, s);
      if (!state.over) t.kugle(ctx, { x: ox, y: H - R, r: R }, s);
      t.antal(ctx, { x: ox < L.W / 2 ? ox + 70 : ox - 70, y: H - 28, n: state.balls }, s);
    }
    t.kant(ctx, { W: L.W, H: L.H }, s);
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 0, cssH = 0, scale = 1, pad = 0, dpr = 1;
    var last = null;
    function resize(w, h) {
      dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      cssW = w; cssH = h;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      pad = (style ? style['kant-w'] + style['kontur-w'] : 8) + 2;
      scale = Math.min(w / (L.W + 2 * pad), h / (L.H + 2 * pad));
      if (last) draw(last.state, last.view);
    }
    function origin() { return { x: (cssW - L.W * scale) / 2, y: (cssH - L.H * scale) / 2 }; }
    function toWorld(px, py) { var o = origin(); return { x: (px - o.x) / scale, y: (py - o.y) / scale }; }
    // view: { preview: {pts, first} }
    function draw(state, view) {
      last = { state: state, view: view || {} };
      if (!style) readStyle();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var o = origin(), k = scale * dpr;
      ctx.setTransform(k, 0, 0, k, o.x * dpr, o.y * dpr);
      drawBoard(ctx, state, last.view, style);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return {
      resize: resize, draw: draw, toWorld: toWorld,
      restyle: function () { readStyle(); if (cssW) resize(cssW, cssH); },
      get scale() { return scale; }
    };
  }

  // Lille stillbillede (startmenu og game over)
  function mini(canvas, state, view) {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(30, Math.round(r.width || canvas.clientWidth || 140)), h = Math.max(40, Math.round(r.height || canvas.clientHeight || 200));
    var dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d'), s = style || readStyle();
    var pad = s['kant-w'] + s['kontur-w'] + 2;
    var k = Math.min(w / (L.W + 2 * pad), h / (L.H + 2 * pad));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, (w - L.W * k) / 2 * dpr, (h - L.H * k) / 2 * dpr);
    drawBoard(ctx, state, view, s);
  }

  global.MurenTegn = { create: create, installerIkoner: installerIkoner, readStyle: readStyle, mini: mini, tone: tone };
})(typeof window !== 'undefined' ? window : globalThis);
