/*
 * Kanonen – tegner slagmarken på et <canvas>: stjernehimmel med stribet sol,
 * landskab med lysende kant og trådnet, kanoner, baner, kugler og nedslag.
 * Farver kommer fra temaets CSS-variabler, så nye temaer kun kræver CSS.
 * Ingen blink og ingen hvide lysglimt: nedslag er orange ringe, der falder
 * roligt ud. Uden animation bliver nedslaget en stille fade.
 */
(function (global) {
  'use strict';

  var G = global.KanonenGame;

  function seeded(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function rgba(hex, a) {
    hex = (hex || '#ffffff').trim();
    if (hex.indexOf('rgb') === 0) return hex;
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function create(canvas) {
    var c = canvas.getContext('2d');
    var colors = {};
    var stars = [];
    var dpr = 1, cw = 0, ch = 0, s = 1;

    function setColors(col) { colors = col; }
    function newSky(seed) {
      var r = seeded(seed || 1);
      stars = [];
      for (var i = 0; i < 140; i++) stars.push({ x: r() * G.WORLD.w, y: r() * G.WORLD.h * 0.62, r: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6 });
    }
    function resize(w, h) {
      dpr = Math.min(2, global.devicePixelRatio || 1);
      cw = w; ch = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      s = w / G.WORLD.w;
    }

    function sky() {
      var W = G.WORLD.w, H = G.WORLD.h;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, colors.sky0); g.addColorStop(0.75, colors.sky1); g.addColorStop(1, colors.sky1);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      stars.forEach(function (st) {
        c.fillStyle = rgba(colors.star, st.a);
        c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill();
      });
      // stribet sol bag bakkerne
      var sx = W * 0.5, sy = H * 0.52, sr = H * 0.24;
      c.save();
      c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.clip();
      var sg = c.createLinearGradient(0, sy - sr, 0, sy + sr);
      sg.addColorStop(0, colors.sun0); sg.addColorStop(1, colors.sun1);
      c.globalAlpha = colors.sunAlpha;
      c.fillStyle = sg; c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      c.globalAlpha = 1;
      c.fillStyle = colors.sky1;
      for (var i = 0; i < 7; i++) {
        var y = sy + sr * (0.05 + i * 0.14), hgt = 3 + i * 2.4;
        c.fillRect(sx - sr, y, sr * 2, hgt);
      }
      c.restore();
    }

    function terrainPath(h) {
      var W = G.WORLD.w, H = G.WORLD.h;
      c.beginPath();
      c.moveTo(0, H);
      for (var x = 0; x <= W; x += 2) c.lineTo(x, h[x]);
      c.lineTo(W, h[W]); c.lineTo(W, H); c.closePath();
    }
    function terrain(h) {
      var W = G.WORLD.w, H = G.WORLD.h;
      c.save();
      terrainPath(h);
      var g = c.createLinearGradient(0, H * 0.3, 0, H);
      g.addColorStop(0, colors.groundFill0); g.addColorStop(1, colors.groundFill1);
      c.fillStyle = g; c.fill();
      // trådnet inde i jorden
      c.clip();
      c.strokeStyle = rgba(colors.ground, colors.gridAlpha); c.lineWidth = 1.2;
      c.beginPath();
      for (var y = 300; y < H; y += 34) { c.moveTo(0, y); c.lineTo(W, y); }
      for (var x = 0; x <= W; x += 64) { c.moveTo(x, 0); c.lineTo(x + (x - W / 2) * 0.25, H); }
      c.stroke();
      c.restore();
      // lysende kant
      c.save();
      c.beginPath();
      c.moveTo(0, h[0]);
      for (x = 2; x <= W; x += 2) c.lineTo(x, h[x]);
      c.strokeStyle = colors.ground; c.lineWidth = 4; c.lineJoin = 'round';
      if (colors.glow) { c.shadowColor = colors.ground; c.shadowBlur = 16; }
      c.stroke();
      c.restore();
    }

    function trail(pts, color, alpha, width, dashed) {
      if (!pts || pts.length < 2) return;
      c.save();
      c.strokeStyle = rgba(color, alpha); c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
      if (dashed) c.setLineDash([10, 12]);
      c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      c.stroke();
      c.restore();
    }

    function cannon(cn, color, active, label) {
      if (cn.dead) {
        c.save();
        c.fillStyle = rgba(color, 0.25); c.strokeStyle = rgba(color, 0.5); c.lineWidth = 3;
        c.beginPath(); c.moveTo(cn.x - 30, cn.y); c.lineTo(cn.x - 14, cn.y - 12); c.lineTo(cn.x + 18, cn.y - 8); c.lineTo(cn.x + 30, cn.y); c.closePath();
        c.fill(); c.stroke();
        c.restore();
        return;
      }
      var m = G.muzzle(cn), K = 1.35;
      c.save();
      if (colors.glow) { c.shadowColor = color; c.shadowBlur = 14; }
      // rør (fra drejepunktet til mundingen)
      c.strokeStyle = color; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cn.x, cn.y - 22); c.lineTo(m.x, m.y); c.stroke();
      // kuppel og bælte, tegnet lidt forstørret omkring kanonens fod
      c.translate(cn.x, cn.y); c.scale(K, K);
      c.fillStyle = colors.cannonFill; c.lineWidth = 3.5;
      c.beginPath(); c.arc(0, -12, 17, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(-32, 2); c.lineTo(-26, -12); c.lineTo(26, -12); c.lineTo(32, 2); c.closePath();
      c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = color;
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 12, -4, 3, 0, Math.PI * 2); c.fill(); }
      c.restore();
      // livsbjælke og navn over kanonen
      var bw = 100, bx = cn.x - bw / 2, by = cn.y - 112;
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(bx - 3, by - 3, bw + 6, 18);
      c.strokeStyle = rgba(color, 0.8); c.lineWidth = 2; c.strokeRect(bx - 3, by - 3, bw + 6, 18);
      c.fillStyle = color; c.fillRect(bx, by, bw * Math.max(0, cn.hp) / 100, 12);
      c.font = '700 26px ' + colors.font; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillStyle = colors.text; c.fillText(label, cn.x, by - 8);
      if (active) { // fast markering af hvis tur det er (ingen blink)
        c.fillStyle = color;
        c.beginPath(); c.moveTo(cn.x - 14, by - 48); c.lineTo(cn.x + 14, by - 48); c.lineTo(cn.x, by - 34); c.closePath(); c.fill();
      }
      c.restore();
    }

    function shell(p, color, big) {
      c.save();
      if (colors.glow) { c.shadowColor = color; c.shadowBlur = 12; }
      c.fillStyle = color; c.strokeStyle = colors.text; c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y, big ? 11 : 7, 0, Math.PI * 2); c.fill();
      if (big) c.stroke();
      c.restore();
    }

    // Nedslag: orange ring der vokser og falder ud – eller stille fade.
    function effect(e, now) {
      var t = Math.min(1, (now - e.t0) / e.dur);
      c.save();
      if (e.kind === 'boom') {
        if (e.calm) {
          c.fillStyle = rgba(colors.boom, 0.45 * (1 - t));
          c.beginPath(); c.arc(e.x, e.y, e.r, 0, Math.PI * 2); c.fill();
        } else {
          var ease = 1 - Math.pow(1 - t, 3);
          c.fillStyle = rgba(colors.boom, 0.35 * (1 - t));
          c.beginPath(); c.arc(e.x, e.y, e.r * (0.4 + 0.6 * ease), 0, Math.PI * 2); c.fill();
          c.strokeStyle = rgba(colors.boom2, 0.9 * (1 - t)); c.lineWidth = 6 * (1 - t) + 1;
          c.beginPath(); c.arc(e.x, e.y, e.r * (0.5 + 0.9 * ease), 0, Math.PI * 2); c.stroke();
          e.bits.forEach(function (b) {
            c.fillStyle = rgba(colors.boom, 0.9 * (1 - t));
            c.beginPath(); c.arc(e.x + b.vx * ease, e.y + b.vy * ease + 140 * t * t, 3.5, 0, Math.PI * 2); c.fill();
          });
        }
      } else if (e.kind === 'dmg') {
        var rise = e.calm ? 0 : 40 * t;
        c.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        c.font = '800 34px ' + colors.font; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(e.text, e.x, e.y - rise);
        c.fillStyle = e.color; c.fillText(e.text, e.x, e.y - rise);
      }
      c.restore();
      return t >= 1;
    }

    function windGauge(wind) {
      var W = G.WORLD.w, x = W / 2, y = 52;
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.strokeStyle = rgba(colors.wind, 0.7); c.lineWidth = 2;
      c.beginPath(); c.rect(x - 170, y - 34, 340, 68); c.fill(); c.stroke();
      c.font = '700 24px ' + colors.font; c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillStyle = colors.text;
      var label = wind === 0 ? 'Vindstille' : 'Vind ' + Math.abs(wind);
      c.fillText(label, x, y - 14);
      if (wind !== 0) {
        var len = 30 + Math.abs(wind) * 11, dir = wind > 0 ? 1 : -1;
        c.strokeStyle = colors.wind; c.fillStyle = colors.wind; c.lineWidth = 6; c.lineCap = 'round';
        if (colors.glow) { c.shadowColor = colors.wind; c.shadowBlur = 10; }
        c.beginPath(); c.moveTo(x - dir * len / 2, y + 14); c.lineTo(x + dir * (len / 2 - 10), y + 14); c.stroke();
        c.beginPath(); c.moveTo(x + dir * len / 2 + dir * 6, y + 14); c.lineTo(x + dir * (len / 2 - 14), y + 2); c.lineTo(x + dir * (len / 2 - 14), y + 26); c.closePath(); c.fill();
      }
      c.restore();
    }

    // state: { match, active: 'spiller'|'computer'|null, flight, effects, now }
    function draw(st) {
      c.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      c.clearRect(0, 0, G.WORLD.w, G.WORLD.h);
      sky();
      var m = st.match;
      if (!m) return;
      // sidste skuds bane bliver stående svagt
      trail(m.trails.spiller, colors.player, 0.32, 3, true);
      trail(m.trails.computer, colors.cpu, 0.32, 3, true);
      terrain(m.h);
      cannon(m.player, colors.player, st.active === 'spiller', 'DU');
      cannon(m.cpu, colors.cpu, st.active === 'computer', 'MODSTANDER ' + m.no);
      if (st.flight) {
        var col = st.flight.shooter === m.player ? colors.player : colors.cpu;
        trail(st.flight.pts, col, 0.85, 3.5, false);
        if (!st.flight.done) shell(st.flight.p, col, st.flight.ammo === 'bombe');
      }
      var now = st.now;
      st.effects = st.effects.filter(function (e) { return !effect(e, now); });
      windGauge(m.wind);
    }

    return { resize: resize, setColors: setColors, newSky: newSky, draw: draw, rgba: rgba };
  }

  global.KanonenRender = { create: create };
})(window);
