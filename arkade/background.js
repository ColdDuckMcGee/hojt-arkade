/*
 * Hojt Arkade – background.js
 * Tre baggrunde tegnet på et <canvas>: 'mork' (rolig og mørk), 'solnedgang'
 * (synthwave-sol og gitter i perspektiv) og 'neonby' (svag by med langsomt
 * svævende lys). Kun langsom, jævn bevægelse – aldrig blink.
 *
 * Ydelse (ældre maskiner, især uden grafikkort): det store lærred tegnes kun, når noget
 * ændrer sig (størrelse, farver, tilstand). Det, der bevæger sig, ligger i egne små lag:
 *  - solnedgang: de vandrette gitterlinjer på et gennemsigtigt lærred, der kun dækker gulvet,
 *  - neonby: hvert svævende lys som sit eget lille lag, som browseren blot flytter.
 * Billedet er det samme som før; det er kun mængden af pixel pr. billede, der er mindre.
 *
 *   const bg = ArkadeBackground.create(canvasEl);
 *   bg.setPalette({ bg0, bg1, sky0, sky1, sky2, sun0, sun1, grid, light1, light2 });
 *   bg.setMode('solnedgang'); bg.setAnimated(true);
 */
(function (global) {
  'use strict';

  function seeded(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hexToRgba(hex, a) {
    hex = (hex || '#ffffff').trim();
    if (hex.indexOf('rgb') === 0) return hex;
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var mode = 'mork', animated = false, raf = 0;
    var W = 0, H = 0, dpr = 1;
    var pal = { bg0: '#0c0612', bg1: '#1d0b2e', sky0: '#07051a', sky1: '#2a0b45', sky2: '#ff2f8f',
                sun0: '#ffd23a', sun1: '#ff2f8f', grid: '#ff2fd2', light1: '#ff2fd2', light2: '#22eaff' };
    var staticLayer = document.createElement('canvas');
    var sctx = staticLayer.getContext('2d');
    var particles = [];
    var floor = null, fctx = null, floorTop = 0;   // solnedgang: lærred kun over gulvet
    var dotsEl = null;                              // neonby: beholder til lysenes egne lag

    function lag(el) {
      el.setAttribute('aria-hidden', 'true');
      var s = el.style;
      s.position = 'fixed'; s.left = '0'; s.top = '0'; s.pointerEvents = 'none';
      s.zIndex = global.getComputedStyle(canvas).zIndex || '0';
      canvas.parentNode.insertBefore(el, dotsEl && el !== dotsEl ? dotsEl : canvas.nextSibling);
      return el;
    }
    function ensureFloor() {
      if (!floor) { floor = lag(document.createElement('canvas')); fctx = floor.getContext('2d'); }
      floorTop = Math.max(0, Math.floor(horizonY() - 12));
      var h = Math.max(1, H - floorTop);
      floor.width = Math.round(W * dpr); floor.height = Math.round(h * dpr);
      floor.style.width = W + 'px'; floor.style.height = h + 'px';
      floor.style.transform = 'translate(0,' + floorTop + 'px)';
    }
    function buildDots() {
      if (!dotsEl) { dotsEl = lag(document.createElement('div')); dotsEl.style.width = '0'; dotsEl.style.height = '0'; dotsEl.style.overflow = 'visible'; }
      dotsEl.textContent = '';
      particles.forEach(function (p) {
        var c = particleSprite(p);
        c.style.position = 'absolute'; c.style.left = '0'; c.style.top = '0';
        c.style.width = (c.width / dpr) + 'px'; c.style.height = (c.height / dpr) + 'px';
        c.style.willChange = 'transform';
        p.el = c; p.half = c.width / 2 / dpr;
        dotsEl.appendChild(c);
      });
    }
    // Lyset tegnes én gang i fuld opløsning (samme gradient som før) og genbruges.
    function particleSprite(p) {
      var R = p.size * 4, px = Math.ceil(R * 2 * dpr) + 2;
      var c = document.createElement('canvas');
      c.width = c.height = px;
      var x = c.getContext('2d'), m = px / 2;
      var g = x.createRadialGradient(m, m, 0, m, m, R * dpr);
      g.addColorStop(0, hexToRgba(p.color, p.alpha));
      g.addColorStop(0.3, hexToRgba(p.color, p.alpha * 0.4));
      g.addColorStop(1, hexToRgba(p.color, 0));
      x.fillStyle = g;
      x.fillRect(m - R * dpr, m - R * dpr, R * 2 * dpr, R * 2 * dpr);
      return c;
    }
    function showLayers() {
      if (floor) floor.style.display = mode === 'solnedgang' ? 'block' : 'none';
      if (dotsEl) dotsEl.style.display = mode === 'neonby' ? 'block' : 'none';
    }

    function resize() {
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = global.innerWidth; H = global.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      buildStatic();
      buildParticles();
      ensureFloor();
      drawFull();
      draw(performance.now());
    }

    // ---------- statiske lag ----------
    function buildStatic() {
      var c = sctx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      if (mode === 'mork') staticMork(c);
      else if (mode === 'solnedgang') staticSunset(c);
      else staticCity(c);
    }
    function staticMork(c) {
      var g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, pal.bg1); g.addColorStop(1, pal.bg0);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = hexToRgba(pal.light2, 0.035); c.lineWidth = 1;
      var s = 48;
      c.beginPath();
      for (var x = (W / 2) % s; x < W; x += s) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
      for (var y = (H / 2) % s; y < H; y += s) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
      c.stroke();
    }
    function horizonY() { return H * 0.6; }
    function staticSunset(c) {
      var hz = horizonY();
      var sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, pal.sky0); sky.addColorStop(0.65, pal.sky1); sky.addColorStop(1, hexToRgba(pal.sky2, 0.55));
      c.fillStyle = sky; c.fillRect(0, 0, W, hz);
      // stjerner (faste, ingen blink)
      var r = seeded(7);
      for (var i = 0; i < 140; i++) {
        var sx = r() * W, sy = r() * hz * 0.8, a = 0.15 + r() * 0.45;
        c.fillStyle = 'rgba(255,255,255,' + a + ')';
        c.fillRect(sx, sy, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1);
      }
      // sol
      var R = Math.min(W, H) * 0.27, cx = W / 2, cy = hz - R * 0.25;
      c.save();
      c.shadowColor = hexToRgba(pal.sun1, 0.8); c.shadowBlur = 60;
      var sg = c.createLinearGradient(0, cy - R, 0, cy + R);
      sg.addColorStop(0, pal.sun0); sg.addColorStop(1, pal.sun1);
      c.fillStyle = sg;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.restore();
      // vandrette striber i nederste halvdel
      c.save();
      c.beginPath(); c.arc(cx, cy, R + 2, 0, Math.PI * 2); c.clip();
      c.fillStyle = sky;
      var y0 = cy - R * 0.05, k = 0;
      for (var yy = y0; yy < cy + R; k++) {
        var gap = 2 + k * 1.6;
        c.fillRect(cx - R - 4, yy, R * 2 + 8, gap);
        yy += gap + Math.max(4, R * 0.12 - k * 2);
      }
      c.restore();
      // gulv
      var fl = c.createLinearGradient(0, hz, 0, H);
      fl.addColorStop(0, pal.bg1); fl.addColorStop(1, pal.bg0);
      c.fillStyle = fl; c.fillRect(0, hz, W, H - hz);
      // horisontglød
      var hg = c.createLinearGradient(0, hz - 30, 0, hz + 30);
      hg.addColorStop(0, hexToRgba(pal.grid, 0)); hg.addColorStop(0.5, hexToRgba(pal.grid, 0.55)); hg.addColorStop(1, hexToRgba(pal.grid, 0));
      c.fillStyle = hg; c.fillRect(0, hz - 30, W, 60);
      // lodrette gitterlinjer mod forsvindingspunktet
      c.strokeStyle = hexToRgba(pal.grid, 0.55); c.lineWidth = 1.5;
      c.shadowColor = pal.grid; c.shadowBlur = 6;
      c.beginPath();
      var n = 24;
      for (var j = -n; j <= n; j++) {
        c.moveTo(W / 2 + j * W * 0.02, hz);
        c.lineTo(W / 2 + j * W * 0.16, H);
      }
      c.stroke();
      c.shadowBlur = 0;
    }
    function staticCity(c) {
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, pal.bg0); g.addColorStop(0.55, pal.bg1); g.addColorStop(1, pal.bg0);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      var layers = [
        { seed: 11, base: 0.62, maxH: 0.42, color: hexToRgba(pal.light1, 0.07), win: 0.10 },
        { seed: 23, base: 0.74, maxH: 0.38, color: 'rgba(8,4,16,0.75)', win: 0.16 },
        { seed: 37, base: 0.86, maxH: 0.3, color: 'rgba(4,2,10,0.92)', win: 0.22 }
      ];
      layers.forEach(function (L, li) {
        var r = seeded(L.seed);
        var x = -10;
        while (x < W + 10) {
          var bw = 30 + r() * 70, bh = H * (0.08 + r() * L.maxH);
          var top = H * L.base - bh;
          c.fillStyle = L.color;
          c.fillRect(x, top, bw, H - top);
          if (r() < 0.25) c.fillRect(x + bw / 2 - 1, top - 20 - r() * 30, 2, 50);
          // vinduer (faste, svage)
          for (var wy = top + 8; wy < H * L.base + 40; wy += 9) {
            for (var wx = x + 5; wx < x + bw - 5; wx += 8) {
              if (r() < L.win * 0.35) {
                c.fillStyle = hexToRgba(r() < 0.5 ? pal.light1 : pal.light2, 0.12 + li * 0.05);
                c.fillRect(wx, wy, 3, 4);
              }
            }
          }
          c.fillStyle = L.color;
          x += bw + r() * 6;
        }
      });
      // dis
      var haze = c.createLinearGradient(0, H * 0.5, 0, H);
      haze.addColorStop(0, hexToRgba(pal.light1, 0)); haze.addColorStop(1, hexToRgba(pal.light1, 0.08));
      c.fillStyle = haze; c.fillRect(0, H * 0.5, W, H * 0.5);
    }
    function buildParticles() {
      var r = seeded(99);
      particles = [];
      var count = Math.round(Math.min(60, (W * H) / 28000));
      for (var i = 0; i < count; i++) {
        particles.push({
          x: r() * W, y: r() * H, size: 1.5 + r() * 4,
          speed: 4 + r() * 10, sway: 6 + r() * 18, phase: r() * Math.PI * 2,
          color: r() < 0.6 ? pal.light1 : pal.light2, alpha: 0.25 + r() * 0.35
        });
      }
      buildDots();
    }

    // ---------- dynamiske dele ----------
    function drawSunsetGrid(t) {
      var hz = horizonY();
      var phase = animated ? (t / 5000) % 1 : 0.35;
      var c = fctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, floor.width, floor.height);
      c.setTransform(dpr, 0, 0, dpr, 0, -floorTop * dpr);   // samme koordinater som hele skærmen
      c.save();
      c.strokeStyle = hexToRgba(pal.grid, 0.6); c.lineWidth = 1.5;
      c.shadowColor = pal.grid; c.shadowBlur = 6;
      c.beginPath();
      for (var k = 0; k < 40; k++) {
        var d = k + 1 - phase;
        if (d <= 0.3) continue;
        var y = hz + (H - hz) * (0.35 / d);
        if (y > H + 2) continue;
        if (y - hz < 1.5) break;
        c.moveTo(0, y); c.lineTo(W, y);
      }
      c.stroke();
      c.restore();
    }
    function drawParticles(t) {
      var sec = t / 1000;
      particles.forEach(function (p) {
        var y = p.y, x = p.x;
        if (animated) {
          y = ((p.y - sec * p.speed) % (H + 40) + (H + 40)) % (H + 40) - 20;
          x = p.x + Math.sin(sec * 0.25 + p.phase) * p.sway;
        }
        if (p.el) p.el.style.transform = 'translate(' + (x - p.half) + 'px,' + (y - p.half) + 'px)';
      });
    }

    // Det store lærred: kun det faste billede, tegnet når noget ændrer sig.
    // Himlen ved horisonten er halvgennemsigtig; før blev laget tegnet oven i sig selv i hvert
    // billede, så den blev dækkende. Det samme resultat laves her én gang.
    function drawFull() {
      if (!W) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (var n = animated && mode !== 'mork' ? 12 : 1; n > 0; n--) ctx.drawImage(staticLayer, 0, 0);
      showLayers();
    }
    function draw(t) {
      if (!W) return;
      if (mode === 'solnedgang') drawSunsetGrid(t);
      else if (mode === 'neonby') drawParticles(t);
    }
    function frame(t) {
      raf = 0;
      draw(t);
      if (animated && mode !== 'mork') raf = requestAnimationFrame(frame);
    }
    function restart() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      drawFull();
      draw(performance.now());
      if (animated && mode !== 'mork') raf = requestAnimationFrame(frame);
    }

    global.addEventListener('resize', function () { resize(); restart(); });
    resize();

    return {
      setMode: function (m) { mode = m; buildStatic(); ensureFloor(); restart(); },
      setAnimated: function (a) { animated = !!a; restart(); },
      setPalette: function (p) { Object.assign(pal, p); buildStatic(); buildParticles(); restart(); },
      getMode: function () { return mode; },
      refresh: function () { resize(); restart(); }
    };
  }

  global.ArkadeBackground = { create: create };
})(window);
