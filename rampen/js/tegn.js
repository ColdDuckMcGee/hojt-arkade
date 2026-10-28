/*
 * Rampen – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og tegner
 * på et canvas. Kender ingen farver, streger, glød, skygger eller skrifter: alle
 * værdier læses som CSS-variabler (--rampen-<navn>) via getComputedStyle, og alle
 * figurer tegnes af temaets navngivne tegnefunktioner (window.RampenTema.tegn).
 *
 * Kameraet følger bilen og zoomer ud, når den kommer højt op. Ved en opsendelse og
 * et beslutningspunkt vises i stedet hele forhåndslinjen (fit).
 */
(function (global) {
  'use strict';
  var T = global.RampenTema;
  var L = global.RampenLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;

  function installerIkoner(doc) {
    doc = doc || document;
    if (doc.getElementById('rampen-ikoner')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'rampen-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'rampen-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (navn) {
      html += '<symbol id="rampen-ikon-' + navn + '" viewBox="0 0 100 100">' + T.ikoner[navn] + '</symbol>';
    });
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn) { return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#rampen-ikon-' + navn + '"/></svg>'; }

  var style = null;
  function readStyle() {
    var cs = getComputedStyle(root), s = {};
    T.farver.forEach(function (n) { s[n] = cs.getPropertyValue('--rampen-' + n).trim() || 'transparent'; });
    T.tal.forEach(function (n) { var v = parseFloat(cs.getPropertyValue('--rampen-' + n)); s[n] = isNaN(v) ? 0 : v; });
    s.font = cs.getPropertyValue('--rampen-font').trim() || 'sans-serif';
    style = s;
    return s;
  }

  // Udsnit: x0 (meter ved venstre kant), k (px pr. meter), gy (jordens y i px)
  function view(w, h, x0, k, gy, zone) {
    return { w: w, h: h, x0: x0, x1: x0 + w / k, k: k, gy: gy, zone: zone,
      sx: function (x) { return (x - x0) * k; }, sy: function (y) { return gy - y * k; } };
  }
  function niceStep(k) { var steps = [10, 25, 50, 100, 250, 500, 1000]; for (var i = 0; i < steps.length; i++) if (steps[i] * k >= 80) return steps[i]; return 2000; }

  // Tegner en hel scene
  // sc: { car: {x,y,vx,vy,ground,boost,nose,chute}, type, vinger, raket, course, taken, tNow,
  //       angle (rampens vinkel), trail, previews: [{pts, slags}], landings: [{x, tekst, slags}] }
  function drawScene(ctx, v, sc, s) {
    var t = T.tegn;
    var mid = v.x0 + (v.x1 - v.x0) / 2, zi = L.zoneIndex(mid), z = L.ZONER[zi], nz = L.ZONER[zi + 1];
    var blend = nz ? Math.max(0, Math.min(1, (mid - (nz.fra - 60)) / 60)) : 0;
    t.himmel(ctx, { zone: z.id, naeste: nz && nz.id, blend: blend }, v, s);
    t.kulisse(ctx, { zone: blend > 0.5 && nz ? nz.id : z.id }, v, s);
    // Jorden: hver zone sin farve (klippes ved zonegrænsen)
    L.ZONER.forEach(function (Z, i) {
      var a = Z.fra, b = L.ZONER[i + 1] ? L.ZONER[i + 1].fra : 1e9;
      if (i === 0) a = -1e9;
      if (b < v.x0 || a > v.x1) return;
      ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, v.sx(a)), 0, Math.min(v.w, v.sx(b)) - Math.max(0, v.sx(a)), v.h); ctx.clip();
      t.jord(ctx, { zone: Z.id }, v, s); ctx.restore();
    });
    // Afstandsmærker og milepæle
    var st = niceStep(v.k);
    for (var m = Math.max(st, Math.ceil(v.x0 / st) * st); m <= v.x1; m += st) t.maaler(ctx, { x: m, tekst: m + ' m' }, v, s);
    L.ZONER.forEach(function (Z) { if (Z.fra > 0 && Z.fra >= v.x0 - 50 && Z.fra <= v.x1) t.milepael(ctx, { x: Z.fra, navn: Z.navn }, v, s); });
    if (v.x0 < 5) t.startrampe(ctx, { h: L.RAMPE.h, len: L.RAMPE.len, vinkel: sc.angle || 30 }, v, s);
    // Ting langs banen
    if (sc.course) sc.course.range(v.x0 - 15, v.x1 + 15).forEach(function (o) {
      var tk = sc.taken && sc.taken[o.id];
      if (tk !== undefined && tk <= (sc.tNow === undefined ? 1e9 : sc.tNow)) return;
      if (t[o.type]) t[o.type](ctx, o, v, s);
    });
    if (sc.trail) t.spor(ctx, sc.trail, v, s);
    (sc.previews || []).forEach(function (p) { t.forhaand(ctx, p, v, s); });
    (sc.landings || []).forEach(function (p) { t.landing(ctx, p, v, s); });
    var c = sc.car;
    if (c) {
      var ang = c.ground ? 0 : Math.atan2(c.vy, Math.max(0.1, c.vx));
      if (sc.preLaunch) ang = (sc.angle || 30) * Math.PI / 180;
      t.bil(ctx, { x: c.x, y: c.y, vinkel: ang, type: sc.type, vinger: sc.vinger, raket: sc.raket, flamme: !!c.boost, skaerm: !!c.chute, naese: c.nose }, v, s);
    }
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 0, cssH = 0, dpr = 1, anim = null, last = null, camK = 0, camX = 0;
    function resize(w, h) {
      dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      cssW = Math.max(1, w); cssH = Math.max(1, h);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      if (last) draw(last);
    }
    function gy() { return cssH * 0.86; }
    function baseK() { return Math.min(cssW / 55, cssH / 24); }
    // Kamera, der følger bilen
    function followCam(c) {
      var k = Math.min(baseK(), (gy() - 24) / (Math.max(0, c.y) + 9));
      return { k: k, x0: c.x - cssW * 0.35 / k };
    }
    // Kamera, der viser hele forhåndslinjen
    function fitCam(sc) {
      var minX = sc.car.x - 6, maxX = sc.car.x + 20, maxY = Math.max(sc.car.y, 8);
      if (sc.preLaunch) minX = -L.RAMPE.len - 2;
      (sc.previews || []).forEach(function (p) { p.pts.forEach(function (q) { if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y; }); });
      (sc.landings || []).forEach(function (p) { if (p.x + 8 > maxX) maxX = p.x + 8; });
      var k = Math.min(baseK(), (cssW - 40) / (maxX - minX + 4), (gy() - 70) / (maxY + 3));
      return { k: k, x0: minX - 20 / k };
    }
    function draw(sc, cam) {
      last = sc;
      if (!style) readStyle();
      cam = cam || (sc.fit ? fitCam(sc) : followCam(sc.car));
      camK = cam.k; camX = cam.x0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      var v = view(cssW, cssH, cam.x0, cam.k, gy());
      drawScene(ctx, v, sc, style);
    }
    // Afspil en række billeder fra logikken. speed > 1 er hurtigere end virkelig tid.
    function animate(sc, frames, opts) {
      stop();
      var raf = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
      var t0 = null, i = 0, T0 = frames[0].t, T1 = frames[frames.length - 1].t;
      var k = camK || followCam(frames[0]).k, x0 = null;
      anim = { id: 0, done: opts.onDone, speed: opts.speed || 1, tt: 0, last: 0 };
      function frame(now) {
        if (!anim) return;
        if (t0 === null) { t0 = now; anim.last = now; }
        anim.tt += (now - anim.last) / 1000 * anim.speed; anim.last = now;
        var tt = Math.min(T1, T0 + anim.tt);
        while (i < frames.length - 2 && frames[i + 1].t < tt) i++;
        var a = frames[i], b = frames[Math.min(frames.length - 1, i + 1)], f = b.t > a.t ? Math.max(0, Math.min(1, (tt - a.t) / (b.t - a.t))) : 1;
        var c = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vx: a.vx + (b.vx - a.vx) * f, vy: a.vy + (b.vy - a.vy) * f,
          ground: b.ground && a.ground, boost: a.boost, nose: a.nose, chute: a.chute, hp: a.hp, coins: a.coins, boosts: a.boosts };
        var target = followCam(c);
        k += (target.k - k) * 0.06;                 // rolig zoom
        var cx0 = c.x - cssW * 0.35 / k;
        x0 = cx0;
        sc.car = c; sc.tNow = tt;
        if (opts.onFrame) opts.onFrame(c, frames, i);
        draw(sc, { k: k, x0: x0 });
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
    // Spring til slutningen af den igangværende afspilning
    function finishNow() {
      if (!anim) return;
      var cb = anim.done; stop(); if (cb) cb();
    }
    return {
      resize: resize, draw: draw, animate: animate, stop: stop, finishNow: finishNow,
      setSpeed: function (sp) { if (anim) anim.speed = sp; },
      restyle: function () { readStyle(); if (cssW) resize(cssW, cssH); },
      get animating() { return !!anim; },
      get scale() { return camK; }
    };
  }

  // Lille billede af bilen (startmenu, værkstedet, slutskærmen)
  function bilBillede(canvas, opts) {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(40, Math.round(r.width || 200)), h = Math.max(30, Math.round(r.height || 120));
    var dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d'), s = style || readStyle();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    var k = Math.min(w / 6, h / 3.2), gy = h * 0.82;
    var v = view(w, h, -w / 2 / k, k, gy, opts.zone || 'forstad');
    T.tegn.jord(ctx, { zone: opts.zone || 'forstad' }, v, s);
    T.tegn.bil(ctx, { x: 0, y: 0, vinkel: 0, type: opts.type, vinger: opts.vinger, raket: opts.raket, flamme: opts.flamme, skaerm: false, naese: 'lige' }, v, s);
  }

  global.RampenTegn = { create: create, installerIkoner: installerIkoner, ikon: ikon, readStyle: readStyle, bilBillede: bilBillede, view: view, drawScene: drawScene };
})(typeof window !== 'undefined' ? window : globalThis);
