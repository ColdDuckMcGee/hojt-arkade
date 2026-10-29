/*
 * Rampen – tegnelaget. Læser kun spillets tilstand (fra js/logik.js) og tegner
 * på et canvas. Kender ingen farver, streger, glød, skygger eller skrifter: alle
 * værdier læses som CSS-variabler (--rampen-<navn>) via getComputedStyle, og alle
 * figurer tegnes af temaets navngivne tegnefunktioner (window.RampenTema.tegn).
 *
 * Kameraet (v1.4) har tre udsnit: tæt på bilen under kørsel og flyvning (fast zoom,
 * følger med op), rampen + bil + startlinje ved opsendelsen, og en oversigt med bil,
 * landingsfelter og udsyn ved beslutningspunktet. Skift glider roligt (ca. 0,7 s,
 * blød ind/ud); ved prefers-reduced-motion eller "uden animation" skiftes direkte.
 *
 * Udsyn: bilen kan kun se et stykke frem (sc.lim i meter, under afspilning
 * bilens x + sc.udsyn). Ting længere fremme tegnes slet ikke, og temaets tåge
 * (tegn.taage) lægges over resten af banen som pynt.
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
  //       angle (rampens vinkel), trail, previews: [{pts, slags}], felter: [{fra, til, nr, tekst, raekke}],
  //       lim (udsynets grænse i meter; udeladt = alt ses) }
  var drawnIds = [];
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
    // Ting langs banen – kun dem inden for udsynet
    var lim = typeof sc.lim === 'number' ? sc.lim : Infinity;
    drawnIds = [];
    if (sc.course) sc.course.range(v.x0 - 15, Math.min(v.x1 + 15, lim)).forEach(function (o) {
      if (o.x - (o.r || 0) > lim) return;
      var tk = sc.taken && sc.taken[o.id];
      if (tk !== undefined && tk <= (sc.tNow === undefined ? 1e9 : sc.tNow)) return;
      if (t[o.type]) { t[o.type](ctx, o, v, s); drawnIds.push({ id: o.id, type: o.type, x: o.x, r: o.r || 0 }); }
    });
    if (sc.trail) t.spor(ctx, sc.trail, v, s);
    if (lim < v.x1 && t.taage) t.taage(ctx, { x: lim }, v, s);
    (sc.felter || []).forEach(function (p) { t.felt(ctx, p, v, s); });
    (sc.previews || []).forEach(function (p) { t.forhaand(ctx, p, v, s); });
    var c = sc.car;
    if (c) {
      var ang = c.ground ? 0 : Math.atan2(c.vy, Math.max(0.1, c.vx));
      if (sc.preLaunch) ang = (sc.angle || 30) * Math.PI / 180;
      t.bil(ctx, { x: c.x, y: c.y, vinkel: ang, type: sc.type, vinger: sc.vinger, raket: sc.raket, flamme: !!c.boost, skaerm: !!c.chute, naese: c.nose }, v, s);
    }
  }

  // Bilens ramme på skærmen (px) – bruges til at holde feltteksterne fri af bilen
  // og af testen, der måler bilens størrelse. Bilen er ca. 3,4 × 1,8 m og tegnes
  // aldrig med mindre end 16 px pr. meter (se temaets bil()).
  var carBox = null, lastLabels = [];
  function carRect(v, c) {
    if (!c) return null;
    var k = Math.max(v.k, 16), x = v.sx(c.x), y = v.sy(c.y);
    return { x: x - 2.2 * k, y: y - 2.1 * k, w: 4.4 * k, h: 2.4 * k, len: 3.4 * k };
  }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  // Feltteksterne må ikke dække bilen: flyt en tekst til højre for bilen, ellers
  // til venstre, ellers ned under jordlinjen (temaets felt() får tekstX / under).
  function placeLabels(ctx, v, felter, box, s) {
    if (!box || !felter || !felter.length) return felter || [];
    var str = s['tekst-str'] || 14, h = Math.max(10, Math.min(18, v.h * 0.03));
    ctx.save(); ctx.font = '700 ' + Math.round(str) + 'px ' + s.font;
    var under = 0;
    var out = felter.map(function (p) {
      if (!p.tekst) return p;
      var tw = ctx.measureText(p.tekst).width + 8, cx = (v.sx(p.fra) + v.sx(p.til)) / 2;
      var y = v.sy(0) - h * 2 - 4 - (p.raekke || 0) * (str + 6);
      var r = { x: cx - tw / 2, y: y - str - 2, w: tw, h: str + 6 };
      if (!overlap(r, box)) { lastLabels.push({ nr: p.nr, x: r.x, y: r.y, w: r.w, h: r.h }); return p; }
      var q = {}; for (var key in p) q[key] = p[key];
      var right = box.x + box.w + 6 + tw / 2, left = box.x - 6 - tw / 2;
      if (right + tw / 2 <= v.w - 4) { q.tekstX = v.x0 + right / v.k; r.x = right - tw / 2; }
      else if (left - tw / 2 >= 4) { q.tekstX = v.x0 + left / v.k; r.x = left - tw / 2; }
      else { q.under = true; q.raekke = under++; r.y = v.sy(0) + h + 4 + q.raekke * (str + 6) - 2; }
      lastLabels.push({ nr: p.nr, x: r.x, y: r.y, w: r.w, h: r.h, flyttet: true });
      return q;
    });
    ctx.restore();
    return out;
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 0, cssH = 0, dpr = 1, anim = null, last = null;
    var cam = null;            // kameraet, som det vises nu: {k, x0, gy}
    var tween = null;          // igangværende rolig zoom mellem to kameraer
    var smooth = true;         // false ved prefers-reduced-motion / "uden animation"
    var EASE_MS = 700;
    var raf = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var caf = global.cancelAnimationFrame || clearTimeout;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mix(a, b, f) { return { k: a.k * Math.pow(b.k / a.k, f), x0: a.x0 + (b.x0 - a.x0) * f, gy: a.gy + (b.gy - a.gy) * f }; }
    function resize(w, h) {
      dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      cssW = Math.max(1, w); cssH = Math.max(1, h);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      stopTween(); cam = null;                    // ny størrelse: skift direkte
      if (last && !anim) draw(last);
    }
    function groundY() { return cssH * 0.86; }
    // Tæt kamera under kørsel og flyvning: fast zoom, så bilen er stor og tydelig
    function zoomK() { return Math.max(28, Math.min(cssW / 20, cssH / 9.5)); }
    // Kamera, der følger bilen. Tæt zoom; når bilen kommer højt op, zoomer det lidt
    // ud (højst til 60 % af den tætte zoom), så jorden stadig kan ses, og derefter
    // følger det med op (jorden glider ud forneden). Zoomen er en jævn funktion af
    // bilens højde, så billedet ikke ryster.
    function followCam(c) {
      var zk = zoomK(), y = Math.max(0, c.y);
      var k = Math.max(Math.max(28, zk * 0.6), Math.min(zk, (groundY() - cssH * 0.22) / (y + 2.2)));
      return { k: k, x0: c.x - cssW * 0.35 / k, gy: Math.max(groundY(), cssH * 0.3 + y * k) };
    }
    // Opsendelse: rampen, bilen og den korte startlinje
    function launchCam(sc) {
      var minX = -L.RAMPE.len - 3, maxX = 18, maxY = 8;
      (sc.previews || []).forEach(function (p) { p.pts.forEach(function (q) { if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y; }); });
      maxX += 4;
      var k = Math.min(zoomK(), (cssW - 40) / (maxX - minX), (groundY() - 60) / (maxY + 3));
      return { k: k, x0: minX - 20 / k, gy: groundY() };
    }
    // Beslutningspunkt: bilen, valgkortenes landingsfelter og udsynets grænse
    function fitCam(sc) {
      if (sc.preLaunch) return launchCam(sc);
      var minX = sc.car.x - 6, maxX = sc.car.x + 20, maxY = Math.max(sc.car.y, 8);
      (sc.previews || []).forEach(function (p) { p.pts.forEach(function (q) { if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y; }); });
      (sc.felter || []).forEach(function (p) { if (p.til + 6 > maxX) maxX = p.til + 6; });
      if (typeof sc.lim === 'number' && sc.lim + 4 > maxX) maxX = sc.lim + 4;
      var k = Math.min(zoomK(), (cssW - 40) / (maxX - minX + 4), (groundY() - 70) / (maxY + 3));
      return { k: k, x0: minX - 20 / k, gy: groundY() };
    }
    function targetCam(sc) { return sc.fit ? fitCam(sc) : followCam(sc.car); }
    function render(sc, c) {
      cam = c;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      var v = view(cssW, cssH, c.x0, c.k, c.gy);
      carBox = carRect(v, sc.car); lastLabels = [];
      var sc2 = sc;
      if (sc.felter && sc.felter.length && carBox) {
        sc2 = {}; for (var key in sc) sc2[key] = sc[key];
        sc2.felter = placeLabels(ctx, v, sc.felter, carBox, style);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      drawScene(ctx, v, sc2, style);
    }
    function stopTween() { if (tween) { caf(tween.id); tween = null; } }
    function same(a, b) { return a && b && Math.abs(a.k / b.k - 1) < 0.01 && Math.abs(a.x0 - b.x0) * b.k < 2 && Math.abs(a.gy - b.gy) < 2; }
    // Tegn en stillestående scene. Skifter kameraet (fx fra flyvning til
    // beslutningspunkt eller tilbage), glider det roligt derhen; uden animation
    // springer det direkte.
    function draw(sc, forced) {
      last = sc;
      if (!style) readStyle();
      if (forced) { stopTween(); render(sc, forced); return; }
      var to = targetCam(sc);
      if (!smooth || !cam || anim) { stopTween(); render(sc, to); return; }
      if (tween && same(tween.to, to)) { tween.sc = sc; return; }
      if (same(cam, to)) { stopTween(); render(sc, to); return; }
      var from = cam;
      stopTween();
      tween = { from: from, to: to, sc: sc, t0: null, id: 0 };
      function step(now) {
        if (!tween) return;
        if (tween.t0 === null) tween.t0 = now;
        var f = Math.min(1, (now - tween.t0) / EASE_MS);
        render(tween.sc, f >= 1 ? tween.to : mix(tween.from, tween.to, ease(f)));
        if (f >= 1) { tween = null; return; }
        tween.id = raf(step);
      }
      render(sc, from);
      tween.id = raf(step);
    }
    // Afspil en række billeder fra logikken. speed > 1 er hurtigere end virkelig tid.
    // Kameraet glider roligt fra det forrige udsnit (fx beslutningspunktets
    // oversigt) ind til det tætte følgekamera i løbet af de første ca. 0,7 s.
    function animate(sc, frames, opts) {
      stop(); stopTween();
      if (!style) readStyle();
      var t0 = null, i = 0, T0 = frames[0].t, T1 = frames[frames.length - 1].t;
      var from = smooth ? cam : null;
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
        var target = followCam(c), g = from ? Math.min(1, (now - t0) / EASE_MS) : 1;
        sc.car = c; sc.tNow = tt;
        if (typeof sc.udsyn === 'number') sc.lim = c.x + sc.udsyn;
        if (opts.onFrame) opts.onFrame(c, frames, i);
        last = sc;
        render(sc, g >= 1 ? target : mix(from, target, ease(g)));
        if (tt >= T1) { var cb = anim.done; anim = null; if (cb) cb(); return; }
        anim.id = raf(frame);
      }
      anim.id = raf(frame);
    }
    function stop() {
      if (!anim) return;
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
      // Rolig zoom til/fra; slås fra ved prefers-reduced-motion og "uden animation"
      setSmooth: function (on) { smooth = !!on; if (!smooth && tween) { var t = tween; stopTween(); render(t.sc, t.to); } },
      restyle: function () { readStyle(); if (cssW) resize(cssW, cssH); },
      get animating() { return !!anim; },
      get zooming() { return !!tween; },
      get drawn() { return drawnIds.slice(); },
      get scale() { return cam ? cam.k : 0; },
      // Bilens ramme på skærmen i px (len = bilens længde i px)
      get carBox() { return carBox ? { x: carBox.x, y: carBox.y, w: carBox.w, h: carBox.h, len: carBox.len } : null; },
      get labels() { return lastLabels.slice(); }
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
