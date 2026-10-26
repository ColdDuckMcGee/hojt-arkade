/*
 * Kanonen – dødseffekt. Når en kanon ødelægges, splittes den i pixelblokke i
 * kanonens neonfarve, der flyver i store buer med tyngdekraft og rotation – helt
 * ud over skærmkanten. Røret flyver af som et større stykke, og en neonring
 * breder sig roligt ud. Ingen blink, ingen hvide glimt, ingen stroboskop.
 *
 * Effekten tegnes på et gennemsigtigt overlay-canvas over hele skærmen
 * (pointer-events: none), så stumperne også kan flyve hen over panelet.
 * Tiden styres af spillets ur, så effekten står stille under pause.
 *
 * Uden animation (indstilling eller prefers-reduced-motion) bliver kanonen i
 * stedet stille opløst på stedet: blokkene falmer én efter én uden bevægelse.
 */
(function (global) {
  'use strict';

  var K = 1.35;           // kanonens krop tegnes 1,35× (som i render.js)
  var MAX_BLOCKS = 150;   // krop-blokke; + gnister + rør holder os under ca. 300
  var SPARKS = 70;
  var DUR = 2300, CALM_DUR = 1600;

  function hexRgb(hex) {
    hex = (hex || '#ff2bd6').trim();
    var m = /rgba?\(([^)]+)\)/.exec(hex);
    if (m) { var p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; }
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Nuancer af neonfarven: mørkere og lysere – men aldrig ren hvid (maks. 35 % mod en lys lavendel).
  function shade(rgb, k) {
    var t = k < 0 ? [0, 0, 0] : [236, 222, 255], a = Math.min(0.35, Math.abs(k));
    return 'rgb(' + rgb.map(function (v, i) { return Math.round(v + (t[i] - v) * a); }).join(',') + ')';
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function create(canvas) {
    var c = canvas.getContext('2d');
    var dpr = 1, W = 0, H = 0;
    var fx = [];

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }

    // o: { x, y (skærm-px for kanonens fod), scale (px pr. spilenhed), color, accent,
    //      barrel: { x1, y1, x2, y2 } i skærm-px, calm, now }
    function start(o) {
      resize();
      var rgb = hexRgb(o.color), acc = hexRgb(o.accent || o.color);
      var palette = [shade(rgb, 0), shade(rgb, 0), shade(rgb, -0.25), shade(rgb, -0.45), shade(rgb, 0.3), shade(acc, 0), shade(acc, -0.3)];
      var sc = o.scale;
      // Prøv kanonens form (kuppel + bælte) i et gitter. Gitteret vælges, så antallet passer.
      var cells = [], step = 4;
      for (var tries = 0; tries < 6; tries++) {
        cells = [];
        for (var wy = -29 * K; wy <= 2 * K; wy += step) {
          for (var wx = -32 * K; wx <= 32 * K; wx += step) {
            var cy = wy + step / 2, cx = wx + step / 2, inside = false;
            if (cy <= -12 * K) { var dx = cx, dy = cy + 12 * K; inside = dx * dx + dy * dy <= 17 * K * 17 * K; }
            else { var half = 26 * K + (cy + 12 * K) / (14 * K) * 6 * K; inside = Math.abs(cx) <= half; }
            if (inside) cells.push({ x: cx, y: cy });
          }
        }
        if (cells.length <= MAX_BLOCKS) break;
        step += 1;
      }
      var minV = Math.min(W, H);
      // blokkene skal kunne ses på alle skærme: mindst ca. 1,4 % af den korte side
      var size = Math.max(5, Math.min(16, Math.max(step * sc * 1.2, 0.014 * minV)));
      var e = { t0: o.now, calm: !!o.calm, dur: o.calm ? CALM_DUR : DUR, x: o.x, y: o.y, ps: [], ring: null, barrel: null, rgb: rgb, accent: acc };
      var g = 1.6 * H;                       // tyngdekraft i px/s²
      cells.forEach(function (cl) {
        var p = { x: o.x + cl.x * sc, y: o.y + cl.y * sc, w: size * rnd(0.75, 1.3), col: palette[(Math.random() * palette.length) | 0], rot: 0 };
        if (e.calm) { p.delay = rnd(0, 1000); p.fade = rnd(380, 560); }
        else {
          var side = cl.x === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(cl.x);
          var up = rnd(0.3, 0.9) * H;         // hvor højt stykket stiger
          p.vy = -Math.sqrt(2 * g * up) * rnd(0.85, 1.05);
          p.vx = side * rnd(0.06, 0.6) * Math.max(W, 0.6 * H) * 0.7 + cl.x * sc * 3;
          p.spin = rnd(-12, 12); p.g = g * rnd(0.85, 1.1);
          p.life = rnd(0.72, 1) * DUR;
        }
        e.ps.push(p);
      });
      if (!e.calm) {
        for (var i = 0; i < SPARKS; i++) {
          var a = rnd(Math.PI * 1.05, Math.PI * 1.95);
          var sp = rnd(0.3, 0.9) * Math.max(W, H) * 0.7;
          e.ps.push({ x: o.x + rnd(-18, 18) * sc, y: o.y - 14 * K * sc, w: Math.max(3, size * 0.5), col: palette[(Math.random() * palette.length) | 0],
            rot: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: rnd(-16, 16), g: g * 0.9, life: rnd(0.45, 0.8) * DUR });
        }
        e.ring = { r: Math.max(80, Math.min(340, 0.32 * minV)) };
        if (o.barrel) {
          var b = o.barrel, mx = (b.x1 + b.x2) / 2, my = (b.y1 + b.y2) / 2;
          var dir = b.x2 >= b.x1 ? 1 : -1;
          e.barrel = { x: mx, y: my, len: Math.hypot(b.x2 - b.x1, b.y2 - b.y1), th: Math.max(5, 12 * sc * 1.1),
            rot: Math.atan2(b.y2 - b.y1, b.x2 - b.x1), vx: dir * W * 0.32, vy: -Math.sqrt(2 * g * 0.95 * H), spin: dir * 7, g: g };
        }
      }
      fx.push(e);
      return e.dur;
    }

    // En blok med en svag neonkant (billig glød: en større, gennemsigtig firkant bagved).
    function drawBlock(x, y, w, rot, col, a, glow) {
      c.save(); c.translate(x, y); if (rot) c.rotate(rot);
      c.fillStyle = col;
      if (glow) { c.globalAlpha = a * 0.28; c.fillRect(-w * 0.85, -w * 0.85, w * 1.7, w * 1.7); }
      c.globalAlpha = a; c.fillRect(-w / 2, -w / 2, w, w);
      c.restore();
    }

    // Tegner alle aktive effekter ved spil-tiden now. Returnerer true, hvis noget stadig kører.
    function draw(now) {
      if (!fx.length) return false;
      if (canvas.width !== Math.round(W * dpr) || !W) resize();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      fx = fx.filter(function (e) {
        var ms = Math.max(0, now - e.t0), t = ms / 1000;
        if (ms >= e.dur) return false;
        if (e.calm) {
          e.ps.forEach(function (p) {
            var k = (ms - p.delay) / p.fade;
            var a = k <= 0 ? 1 : k >= 1 ? 0 : 1 - k * k * (3 - 2 * k);
            if (a > 0) drawBlock(p.x, p.y, p.w, 0, p.col, a, false);
          });
          c.globalAlpha = 1;
          return true;
        }
        // chokbølge: én neonring og en orange ring lige bagefter, der falmer roligt
        var rt = Math.min(1, ms / 800), re = 1 - Math.pow(1 - rt, 3);
        if (rt < 1) {
          c.globalAlpha = 0.8 * (1 - rt);
          c.lineWidth = 3 + 9 * (1 - rt);
          c.strokeStyle = shade(e.rgb, 0);
          c.beginPath(); c.arc(e.x, e.y - 10, e.ring.r * re, 0, Math.PI * 2); c.stroke();
          c.globalAlpha = 0.5 * (1 - rt);
          c.strokeStyle = shade(e.accent, 0); c.lineWidth = 2 + 5 * (1 - rt);
          c.beginPath(); c.arc(e.x, e.y - 10, e.ring.r * re * 0.7, 0, Math.PI * 2); c.stroke();
        }
        e.ps.forEach(function (p) {
          if (ms > p.life) return;
          var x = p.x + p.vx * t, y = p.y + p.vy * t + 0.5 * p.g * t * t;
          if (x < -40 || x > W + 40 || y > H + 40) return;
          var lt = ms / p.life, a = lt < 0.7 ? 1 : 1 - (lt - 0.7) / 0.3;
          drawBlock(x, y, p.w, p.spin * t, p.col, a, true);
        });
        var b = e.barrel;
        if (b) {
          var bx = b.x + b.vx * t, by = b.y + b.vy * t + 0.5 * b.g * t * t, ba = ms < e.dur * 0.75 ? 1 : 1 - (ms - e.dur * 0.75) / (e.dur * 0.25);
          c.save();
          c.globalAlpha = ba; c.translate(bx, by); c.rotate(b.rot + b.spin * t);
          c.shadowColor = shade(e.rgb, 0); c.shadowBlur = 12;
          c.fillStyle = shade(e.rgb, 0);
          c.fillRect(-b.len / 2, -b.th / 2, b.len, b.th);
          c.shadowBlur = 0; c.fillStyle = shade(e.rgb, -0.45);
          c.fillRect(-b.len / 2 + b.th * 0.4, -b.th * 0.15, b.len - b.th * 0.8, b.th * 0.3);
          c.restore();
        }
        c.globalAlpha = 1;
        return true;
      });
      if (!fx.length) c.clearRect(0, 0, W, H);
      return fx.length > 0;
    }

    function clear() { fx = []; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); }
    function count() { return fx.reduce(function (n, e) { return n + e.ps.length + (e.barrel ? 1 : 0); }, 0); }

    return { start: start, draw: draw, clear: clear, resize: resize, active: function () { return fx.length > 0; }, count: count };
  }

  global.KanonenDoed = { create: create, DUR: DUR, CALM_DUR: CALM_DUR };
})(window);
