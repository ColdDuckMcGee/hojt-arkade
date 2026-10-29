/*
 * Kælderen – tegnelaget: en raycaster i canvas (som Wolfenstein 3D / Doom).
 *
 * Læser kun spillets tilstand (fra js/logik.js) og tegner:
 *  - teksturerede vægge, gulve og lofter (floor/ceiling casting),
 *  - farvet lys fra lamperne og lommelygten med blød variation (aldrig blink),
 *  - afstandståge, mørke hjørner (lyset samles i felterne, så hjørnerne bliver mørke) og vignet,
 *  - sprites for fjender, ting, lamper og trappen med dybdesortering (z-buffer),
 *  - selvlysende neon (temaets glød-lag), der kan slås fra,
 *  - overlays: fjendens liv, hvem der kan ramme dig, markering, våben, skade, kort og minikort.
 *
 * Kender ingen farver eller figurer: alt hentes ved navn fra temaet (window.KaelderTema)
 * og fra CSS-variablerne --kaelder-<navn>. Billedet regnes i en lavere intern
 * opløsning, der automatisk følger billedraten (så det kører på svage pc'er), og
 * skaleres op.
 */
(function (global) {
  'use strict';
  var T = global.KaelderTema;
  var L = global.KaelderLogik;
  var root = document.documentElement;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TS = 64;
  var BAG = 0.3;

  function installerIkoner() {
    if (document.getElementById('kaelder-ikoner')) return;
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.id = 'kaelder-ikoner';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'kaelder-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (n) { html += '<symbol id="kaelder-ikon-' + n + '" viewBox="0 0 100 100">' + T.ikoner[n] + '</symbol>'; });
    svg.innerHTML = '<defs>' + html + '</defs>';
    document.body.insertBefore(svg, document.body.firstChild);
  }

  var style = null;
  function readStyle() {
    var cs = getComputedStyle(root), s = {};
    T.farver.forEach(function (n) { s[n] = cs.getPropertyValue('--kaelder-' + n).trim() || 'transparent'; });
    (T.tekster || []).forEach(function (n) { s[n] = cs.getPropertyValue('--kaelder-' + n).trim(); });
    T.tal.forEach(function (n) { var v = parseFloat(cs.getPropertyValue('--kaelder-' + n)); s[n] = isNaN(v) ? 0 : v; });
    style = s;
    return s;
  }

  // Byg en tekstur (farve + glød) ud fra temaets tegnefunktioner
  function bygBillede(tegnF, gloedF, s) {
    var c = document.createElement('canvas'); c.width = c.height = TS;
    var x = c.getContext('2d', { willReadFrequently: true });
    tegnF(x, TS, s);
    var col = x.getImageData(0, 0, TS, TS).data;
    var em = null;
    if (gloedF) {
      x.clearRect(0, 0, TS, TS); x.globalAlpha = 1;
      gloedF(x, TS, s);
      em = x.getImageData(0, 0, TS, TS).data;
    }
    return { col: col, em: em };
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var intern = document.createElement('canvas'), ictx = intern.getContext('2d');
    var lille = document.createElement('canvas'), lctx = lille.getContext('2d');
    var img = null, buf = null, iw = 0, ih = 0, zbuf = null, colInfo = null, vig = null, cone = null;
    var cssW = 300, cssH = 200, dpr = 1;
    var tex = {}, spr = {}, s = null, farve = {};
    var kvalitet = 'auto', skala = 0.6, renderMs = 8, fpsEma = 60, sidstFrame = 0;
    var lysKort = null, lysNoegle = '';
    var cam = { x: 0, y: 0, a: 0 }, anim = null, bump = null, varighed = 300;
    var spriteRects = [], dybde = [];
    var svaevere = [], skadeT = null, skudT = null, spoegelser = [];
    var kortGeo = null, sidsteState = null, sidstAnimeret = true;

    function restyle() {
      s = readStyle();
      tex = {}; spr = {};
      Object.keys(T.teksturer).forEach(function (n) { tex[n] = bygBillede(T.teksturer[n], T.gloed[n], s); });
      Object.keys(T.sprites).forEach(function (n) { var d = T.sprites[n]; var b = bygBillede(d.tegn, d.gloed, s); b.str = d.str; b.sted = d.sted; spr[n] = b; });
      ['taage', 'moerke', 'lampe-lys', 'lygte-lys'].forEach(function (n) { var c = T.rgb(s[n]); farve[n] = [c[0] / 255, c[1] / 255, c[2] / 255]; });
      lysNoegle = '';
    }

    function resize(w, h) {
      cssW = Math.max(40, Math.round(w)); cssH = Math.max(40, Math.round(h));
      dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      iw = 0; // intern opløsning laves igen ved næste billede
    }
    function setKvalitet(k) { kvalitet = k; if (k === 'lav') skala = 0.4; if (k === 'hoej') skala = 1; }

    function internStr() {
      var maxW = kvalitet === 'hoej' ? 1280 : kvalitet === 'lav' ? 420 : 960;
      var w = Math.max(160, Math.min(maxW, Math.round(cssW * skala)));
      var h = Math.max(100, Math.round(w * cssH / cssW));
      return { w: w, h: h };
    }
    function klarBuffer() {
      var z = internStr();
      if (z.w === iw && z.h === ih && img) return;
      iw = z.w; ih = z.h;
      intern.width = iw; intern.height = ih;
      img = ictx.createImageData(iw, ih); buf = img.data;
      zbuf = new Float32Array(iw); colInfo = new Array(iw);
      vig = new Float32Array(iw * ih); cone = new Float32Array(iw);
      var k = s['vignet'];
      for (var y = 0; y < ih; y++) for (var x = 0; x < iw; x++) {
        var dx = (x / iw - 0.5) * 2, dy = (y / ih - 0.5) * 2, r = dx * dx * 0.7 + dy * dy * 0.9;
        vig[y * iw + x] = Math.max(0.15, 1 - k * r * 0.6);
      }
      for (var x2 = 0; x2 < iw; x2++) { var c = (x2 / iw - 0.5) * 2; cone[x2] = 1 - 0.45 * c * c; }
      lille.width = Math.max(8, iw >> 3); lille.height = Math.max(6, ih >> 3);
    }

    // ---------- Lys: hver lampe lyser felterne op, den kan "se" ----------
    function byggLys(st) {
      var aabne = 0; for (var i = 0; i < st.cells.length; i++) if (st.cells[i] === L.AABEN) aabne++;
      var key = st.etage + ':' + st.W + ':' + aabne + ':' + st.lamper.length;
      if (key === lysNoegle && lysKort) return;
      lysNoegle = key;
      var W = st.W, H = st.H, N = W * H, lr = new Float32Array(N);
      st.lamper.forEach(function (l) {
        var R = 5.5;
        for (var y = Math.max(0, Math.floor(l.y - R)); y <= Math.min(H - 1, Math.ceil(l.y + R)); y++)
          for (var x = Math.max(0, Math.floor(l.x - R)); x <= Math.min(W - 1, Math.ceil(l.x + R)); x++) {
            var d = Math.hypot(x - l.x, y - l.y); if (d > R) continue;
            if (!L.gaaelig(st.cells[y * W + x]) || !fri(st, l.x, l.y, x, y)) continue;
            var v = Math.pow(1 - d / R, 1.6); lr[y * W + x] += v;
          }
      });
      // Vægfelter får lidt af naboernes lys, så hjørnerne bliver bløde og mørke
      var out = new Float32Array(N);
      for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
        var k = y2 * W + x2;
        if (L.gaaelig(st.cells[k])) { out[k] = Math.min(1.4, lr[k]); continue; }
        var sum = 0, n = 0;
        for (var d2 = 0; d2 < 4; d2++) { var nx = x2 + L.DX[d2], ny = y2 + L.DY[d2]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; var kk = ny * W + nx; if (L.gaaelig(st.cells[kk])) { sum += lr[kk]; n++; } }
        out[k] = n ? Math.min(1.4, sum / n) * 0.3 : 0;
      }
      lysKort = out;
    }
    function fri(st, x0, y0, x1, y1) {
      var n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2);
      for (var i = 1; i < n; i++) {
        var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        if (!L.gaaelig(st.cells[y * st.W + x])) return false;
      }
      return true;
    }
    // Lampelys i et punkt (bilineært mellem felternes midter)
    function lysI(st, wx, wy) {
      var fx = wx - 0.5, fy = wy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, W = st.W, H = st.H;
      if (x0 < 0) { x0 = 0; tx = 0; } if (y0 < 0) { y0 = 0; ty = 0; }
      var x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
      var a = lysKort[y0 * W + x0], b = lysKort[y0 * W + x1], c = lysKort[y1 * W + x0], d = lysKort[y1 * W + x1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }

    // ---------- Kamera og glidende bevægelse ----------
    function vinkel(dir) { return (dir - 1) * Math.PI / 2; }
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function overgang(fra, til, ms, animeret) {
      varighed = ms;
      if (!animeret || !fra) { anim = null; cam = { x: til.x + 0.5, y: til.y + 0.5, a: vinkel(til.dir) }; return; }
      var a0 = vinkel(fra.dir), a1 = vinkel(til.dir), d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      var x0 = fra.x + 0.5, y0 = fra.y + 0.5;
      // Kommer et nyt træk, mens det forrige stadig glider, fortsætter det herfra (intet hop)
      if (anim) { x0 = cam.x; y0 = cam.y; a0 = cam.a; d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; }
      anim = { t0: performance.now(), x0: x0, y0: y0, a0: a0, x1: til.x + 0.5, y1: til.y + 0.5, a1: a0 + d };
    }
    function stoed(dir, animeret) { if (animeret) bump = { t0: performance.now(), dir: dir }; }
    function opdaterKamera(now, st) {
      var p = st.spiller;
      if (anim) {
        var t = Math.min(1, (now - anim.t0) / varighed), e = ease(t);
        cam.x = anim.x0 + (anim.x1 - anim.x0) * e; cam.y = anim.y0 + (anim.y1 - anim.y0) * e; cam.a = anim.a0 + (anim.a1 - anim.a0) * e;
        if (t >= 1) { anim = null; cam = { x: p.x + 0.5, y: p.y + 0.5, a: vinkel(p.dir) }; }
      } else cam = { x: p.x + 0.5, y: p.y + 0.5, a: vinkel(p.dir) };
      // Kameraet står lidt bag midten af feltet (som i klassiske gitter-spil), så en væg
      // lige foran ikke fylder hele billedet, og man ser lidt af gangene til siderne
      cam.x -= Math.cos(cam.a) * BAG; cam.y -= Math.sin(cam.a) * BAG;
      if (bump) {
        var tb = (now - bump.t0) / 220;
        if (tb >= 1) bump = null;
        else { var k = Math.sin(tb * Math.PI) * 0.09; cam.x += L.DX[bump.dir] * k; cam.y += L.DY[bump.dir] * k; }
      }
    }
    function fjendePos(f, now) {
      if (!anim || f.px === undefined) return { x: f.x + 0.5, y: f.y + 0.5 };
      var e = ease(Math.min(1, (now - anim.t0) / varighed));
      return { x: f.px + (f.x - f.px) * e + 0.5, y: f.py + (f.y - f.py) * e + 0.5 };
    }
    function fjendeTid(now) { return anim ? Math.min(1, (now - anim.t0) / varighed) : 1; }

    // Hændelser fra et træk: tal over fjender, skade-tone, skud, fjender der forsvinder
    function haendelser(st, evs, animeret) {
      var now = performance.now();
      svaevere = svaevere.filter(function (v) { return animeret && now - v.t0 < 900; });
      if (!animeret) { skadeT = null; skudT = null; }
      evs.forEach(function (e) {
        if (e.type === 'skade') skadeT = { t0: now, n: e.n, statisk: !animeret };
        if (e.type === 'skud' || e.type === 'slag') skudT = { t0: now, statisk: !animeret };
        if ((e.type === 'traf' || e.type === 'miss' || e.type === 'slag') && st.sidsteSkud) {
          var ss = st.sidsteSkud;
          svaevere.push({ t0: now, x: ss.x + 0.5, y: ss.y + 0.5, tekst: e.type === 'miss' ? 'Forbi' : (e.doed ? 'Nedkæmpet' : '−' + st.spiller.vaaben), statisk: !animeret });
        }
        if (e.type === 'drab' && animeret) spoegelser.push({ t0: now, x: e.x + 0.5, y: e.y + 0.5, type: e.fjende });
      });
    }
    function aktiv(now) {
      return !!(anim || bump || (skadeT && !skadeT.statisk && now - skadeT.t0 < 1000) || (skudT && !skudT.statisk && now - skudT.t0 < 400) ||
        svaevere.some(function (v) { return !v.statisk && now - v.t0 < 900; }) || spoegelser.length);
    }

    // ---------- Selve billedet ----------
    function render(st, view, now) {
      var t0 = performance.now();
      sidsteState = st;
      sidstAnimeret = !!view.animeret;
      klarBuffer(); byggLys(st);
      opdaterKamera(now, st);
      var W = st.W, H = st.H, cells = st.cells, rum = st.rum;
      var w = iw, h = ih, half = h / 2;
      var dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
      var pl = Math.max(0.42, Math.min(0.92, 0.5 * cssW / cssH));
      var plX = -dirY * pl, plY = dirX * pl;
      var P = w / (2 * pl);
      var sight = L.sigt(st) + 0.5;
      var fogS = s['taage-start'] * sight, fogE = s['taage-slut'] * sight;
      var fog = farve['taage'], amb = farve['moerke'], lam = farve['lampe-lys'], lyg = farve['lygte-lys'];
      var A = s['lys-omgivelse'], LA = s['lys-lampe'], LY = s['lys-lygte'], EM = s['gloed'];
      var flim = view.animeret ? 1 + s['flimmer'] * (Math.sin(now / 1000 * 1.9) * 0.6 + Math.sin(now / 1000 * 3.3 + 1.3) * 0.4) : 1;
      function fogAt(d) { if (d <= fogS) return 0; if (d >= fogE) return 1; var t = (d - fogS) / (fogE - fogS); return t * t * (3 - 2 * t); }
      function lygte(d) { var v = 1 - d / (sight + 1.5); return v > 0 ? Math.pow(v, 1.4) * LY : 0; }
      var rdx0 = dirX - plX, rdy0 = dirY - plY, rdx1 = dirX + plX, rdy1 = dirY + plY;
      var gt = tex['gulv'], gr = tex['gulv-rum'], gtr = tex['gulv-trappe'], lt = tex['loft'], lr2 = tex['loft-rum'];
      var trI = st.trappe ? st.trappe.y * W + st.trappe.x : -1;
      var top = new Int16Array(w), bot = new Int16Array(w);

      // 1) Vægge (DDA)
      for (var x = 0; x < w; x++) {
        var cx = 2 * x / w - 1, rx = dirX + plX * cx, ry = dirY + plY * cx;
        var mx = Math.floor(cam.x), my = Math.floor(cam.y);
        var ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9));
        var sx, sy, sdx, sdy;
        if (rx < 0) { sx = -1; sdx = (cam.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - cam.x) * ddx; }
        if (ry < 0) { sy = -1; sdy = (cam.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - cam.y) * ddy; }
        var side = 0, c = 0, n = 0;
        while (n++ < 64) {
          if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
          if (mx < 0 || my < 0 || mx >= W || my >= H) { c = L.VAEG; break; }
          c = cells[my * W + mx];
          if (!L.gaaelig(c)) break;
        }
        var perp = side === 0 ? sdx - ddx : sdy - ddy;
        if (perp < 0.02) perp = 0.02;
        zbuf[x] = perp;
        var hx = cam.x + perp * rx, hy = cam.y + perp * ry;
        var wallX = side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
        var tX = Math.floor(wallX * TS); if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tX = TS - 1 - tX;
        var fxc = side === 0 ? mx - sx : mx, fyc = side === 1 ? my - sy : my;
        var faceRum = (fxc >= 0 && fyc >= 0 && fxc < W && fyc < H) ? rum[fyc * W + fxc] : -1;
        var tx = c === L.DOER ? tex['doer'] : c === L.LAAST ? tex['doer-laast'] : faceRum >= 0 ? tex['vaeg-rum'] : tex['vaeg'];
        var lineH = P / perp, ds = half - lineH / 2, de = half + lineH / 2;
        var y0 = Math.max(0, Math.floor(ds)), y1 = Math.min(h, Math.ceil(de));
        top[x] = y0; bot[x] = y1;
        colInfo[x] = { mx: mx, my: my, c: c, fx: fxc, fy: fyc, top: ds, bot: de, d: perp };
        var lv = lysI(st, hx - rx * 0.06, hy - ry * 0.06) * LA * flim, ly = lygte(perp) * cone[x], fg = fogAt(perp), sh = side ? 0.78 : 1;
        var mR = (A * amb[0] + lv * lam[0] + ly * lyg[0]) * (1 - fg) * sh, mG = (A * amb[1] + lv * lam[1] + ly * lyg[1]) * (1 - fg) * sh, mB = (A * amb[2] + lv * lam[2] + ly * lyg[2]) * (1 - fg) * sh;
        var fR = fog[0] * 255 * fg, fG = fog[1] * 255 * fg, fB = fog[2] * 255 * fg, em = EM * (1 - 0.75 * fg);
        var col = tx.col, emA = tx.em, step = TS / lineH, tpos = (y0 - ds) * step;
        for (var y = y0; y < y1; y++, tpos += step) {
          var tY = tpos | 0; if (tY > TS - 1) tY = TS - 1;
          var ti = (tY * TS + tX) * 4, o = (y * w + x) * 4, v = vig[y * w + x];
          var r = col[ti] * mR + fR, g = col[ti + 1] * mG + fG, b = col[ti + 2] * mB + fB;
          if (emA && emA[ti + 3]) { var ea = emA[ti + 3] / 255 * em; r += emA[ti] * ea; g += emA[ti + 1] * ea; b += emA[ti + 2] * ea; }
          buf[o] = r * v; buf[o + 1] = g * v; buf[o + 2] = b * v; buf[o + 3] = 255;
        }
      }

      // 2) Gulv og loft (række for række)
      for (var yy = Math.floor(half) + 1; yy < h; yy++) {
        var p = yy - half, rowD = 0.5 * P / p;
        var stX = rowD * (rdx1 - rdx0) / w, stY = rowD * (rdy1 - rdy0) / w;
        var fx = cam.x + rowD * rdx0, fy = cam.y + rowD * rdy0;
        var fgR = fogAt(rowD), lyR = lygte(rowD), fR2 = fog[0] * 255 * fgR, fG2 = fog[1] * 255 * fgR, fB2 = fog[2] * 255 * fgR, emR = EM * (1 - 0.75 * fgR);
        var yc = h - 1 - yy;
        for (var x3 = 0; x3 < w; x3++, fx += stX, fy += stY) {
          var gulv = yy >= bot[x3], loft = yc < top[x3];
          if (!gulv && !loft) continue;
          var cxx = Math.floor(fx), cyy = Math.floor(fy);
          if (cxx < 0 || cyy < 0 || cxx >= W || cyy >= H) continue;
          var ci = cyy * W + cxx, ir = rum[ci] >= 0;
          var ttx = ((fx - cxx) * TS) | 0, tty = ((fy - cyy) * TS) | 0, tI = (tty * TS + ttx) * 4;
          var lv2 = lysI(st, fx, fy) * LA * flim, ly2 = lyR * cone[x3], k1 = 1 - fgR;
          var mR2 = (A * amb[0] + lv2 * lam[0] + ly2 * lyg[0]) * k1, mG2 = (A * amb[1] + lv2 * lam[1] + ly2 * lyg[1]) * k1, mB2 = (A * amb[2] + lv2 * lam[2] + ly2 * lyg[2]) * k1;
          if (gulv) {
            var gx = ci === trI ? gtr : ir ? gr : gt, gc = gx.col, ge = gx.em, o2 = (yy * w + x3) * 4, v2 = vig[yy * w + x3];
            var r2 = gc[tI] * mR2 + fR2, g2 = gc[tI + 1] * mG2 + fG2, b2 = gc[tI + 2] * mB2 + fB2;
            if (ge && ge[tI + 3]) { var ea2 = ge[tI + 3] / 255 * emR; r2 += ge[tI] * ea2; g2 += ge[tI + 1] * ea2; b2 += ge[tI + 2] * ea2; }
            buf[o2] = r2 * v2; buf[o2 + 1] = g2 * v2; buf[o2 + 2] = b2 * v2; buf[o2 + 3] = 255;
          }
          if (loft) {
            var lx = ir ? lr2 : lt, lc = lx.col, le = lx.em, o3 = (yc * w + x3) * 4, v3 = vig[yc * w + x3];
            var r3 = lc[tI] * mR2 * 0.85 + fR2, g3 = lc[tI + 1] * mG2 * 0.85 + fG2, b3 = lc[tI + 2] * mB2 * 0.85 + fB2;
            if (le && le[tI + 3]) { var ea3 = le[tI + 3] / 255 * emR; r3 += le[tI] * ea3; g3 += le[tI + 1] * ea3; b3 += le[tI + 2] * ea3; }
            buf[o3] = r3 * v3; buf[o3 + 1] = g3 * v3; buf[o3 + 2] = b3 * v3; buf[o3 + 3] = 255;
          }
        }
      }
      // Midterlinjen (horisonten), hvis den ikke blev ramt
      // 3) Sprites, sorteret fjernest først
      var liste = [];
      var tf = fjendeTid(now);
      st.lamper.forEach(function (l) { liste.push({ navn: 'lampe', x: l.x + 0.5, y: l.y + 0.5, kind: 'lampe' }); });
      st.ting.forEach(function (t) { liste.push({ navn: t.type, x: t.x + 0.5, y: t.y + 0.5, kind: 'ting', ref: t }); });
      if (st.trappe) liste.push({ navn: 'trappe', x: st.trappe.x + 0.5, y: st.trappe.y + 0.5, kind: 'trappe' });
      st.fjender.forEach(function (f) { var q = fjendePos(f, now); liste.push({ navn: f.type, x: q.x, y: q.y, kind: 'fjende', ref: f }); });
      spoegelser = spoegelser.filter(function (g) { return now - g.t0 < 450; });
      spoegelser.forEach(function (g) { liste.push({ navn: g.type, x: g.x, y: g.y, kind: 'spoegelse', synk: (now - g.t0) / 450 }); });
      var invDet = 1 / (plX * dirY - dirX * plY);
      liste.forEach(function (o) {
        var sx2 = o.x - cam.x, sy2 = o.y - cam.y;
        o.tX = invDet * (dirY * sx2 - dirX * sy2); o.tY = invDet * (-plY * sx2 + plX * sy2);
      });
      liste = liste.filter(function (o) { return o.tY > 0.12; }).sort(function (a, b) { return b.tY - a.tY; });
      spriteRects = [];
      liste.forEach(function (o) {
        var im = spr[o.navn]; if (!im) return;
        var d = o.tY, size = P / d * im.str, scx = (w / 2) * (1 + o.tX / d);
        var floorY = half + 0.5 * P / d, ceilY = half - 0.5 * P / d, topY;
        if (im.sted === 'gulv') topY = floorY - size;
        else if (im.sted === 'loft') topY = ceilY;
        else topY = half + 0.08 * P / d - size / 2;
        if (o.kind === 'ting' && im.sted === 'svaev') topY = half + 0.12 * P / d - size / 2;
        if (o.synk) topY += size * o.synk * 0.9;
        var x0 = Math.floor(scx - size / 2), x1 = Math.ceil(scx + size / 2);
        var yA = Math.max(0, Math.floor(topY)), yB = Math.min(h, Math.ceil(topY + size));
        if (o.synk) yB = Math.min(yB, Math.ceil(floorY));
        if (x1 < 0 || x0 >= w || yB <= yA) return;
        var lv3 = lysI(st, o.x, o.y) * LA * flim, ly3 = lygte(d), fg3 = fogAt(d), k3 = 1 - fg3;
        var mR3 = (A * amb[0] + lv3 * lam[0] + ly3 * lyg[0]) * k3, mG3 = (A * amb[1] + lv3 * lam[1] + ly3 * lyg[1]) * k3, mB3 = (A * amb[2] + lv3 * lam[2] + ly3 * lyg[2]) * k3;
        var fR3 = fog[0] * 255 * fg3, fG3 = fog[1] * 255 * fg3, fB3 = fog[2] * 255 * fg3, em3 = EM * (1 - 0.75 * fg3);
        var col3 = im.col, emB = im.em, synlig = false, vx0 = w, vx1 = -1;
        for (var xs = Math.max(0, x0); xs < Math.min(w, x1); xs++) {
          if (d >= zbuf[xs]) continue;
          var tX3 = Math.floor((xs - (scx - size / 2)) / size * TS); if (tX3 < 0 || tX3 >= TS) continue;
          for (var ys = yA; ys < yB; ys++) {
            var tY3 = Math.floor((ys - topY) / size * TS); if (tY3 < 0 || tY3 >= TS) continue;
            var ti3 = (tY3 * TS + tX3) * 4; if (col3[ti3 + 3] < 128) continue;
            var o4 = (ys * w + xs) * 4, v4 = vig[ys * w + xs];
            var r4 = col3[ti3] * mR3 + fR3, g4 = col3[ti3 + 1] * mG3 + fG3, b4 = col3[ti3 + 2] * mB3 + fB3;
            if (emB && emB[ti3 + 3]) { var ea4 = emB[ti3 + 3] / 255 * em3; r4 += emB[ti3] * ea4; g4 += emB[ti3 + 1] * ea4; b4 += emB[ti3 + 2] * ea4; }
            buf[o4] = r4 * v4; buf[o4 + 1] = g4 * v4; buf[o4 + 2] = b4 * v4;
            synlig = true;
          }
          if (xs < vx0) vx0 = xs; if (xs > vx1) vx1 = xs;
        }
        if (synlig && o.kind !== 'lampe' && o.kind !== 'spoegelse') spriteRects.push({ kind: o.kind, ref: o.ref, navn: o.navn, x: x0, y: topY, w: size, h: size, d: d, vx0: vx0, vx1: vx1, cx: Math.floor(o.x), cy: Math.floor(o.y) });
      });
      ictx.putImageData(img, 0, 0);
      // Skaler op til skærmen
      var DW = canvas.width, DH = canvas.height, sc = DW / w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(intern, 0, 0, DW, DH);
      if (s['bloom'] > 0 && view.gloed) { lctx.imageSmoothingEnabled = true; lctx.drawImage(intern, 0, 0, lille.width, lille.height); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var k2 = cssW / w;
      overlays(st, view, now, k2, P, dirX, dirY, plX, plY, invDet, sc);
      // Billedrate og automatisk opløsning
      var ms = performance.now() - t0;
      renderMs = renderMs * 0.85 + ms * 0.15;
      if (sidstFrame) { var dt = now - sidstFrame; if (dt > 0 && dt < 500) fpsEma = fpsEma * 0.9 + (1000 / dt) * 0.1; }
      sidstFrame = now;
      if (kvalitet === 'auto') {
        if (renderMs > 16 && skala > 0.3) { skala = Math.max(0.3, skala * 0.92); }
        else if (renderMs < 6 && skala < 1) { skala = Math.min(1, skala * 1.04); }
      }
    }

    // ---------- Overlays i skærmens opløsning ----------
    function overlays(st, view, now, k, P, dirX, dirY, plX, plY, invDet) {
      var tg = T.tegn, W = cssW, H = cssH;
      if (view.gloed) tg.efter(ctx, { w: W, h: H, kilde: s['bloom'] > 0 ? lille : null }, s);
      var trus = view.trusler || [];
      var tekstStr = Math.max(13, Math.min(24, W / 46));
      // Fjendernes liv og trusler
      // Nærmeste først; en fjernere fjendes skilt skubbes op, så skiltene aldrig dækker hinanden
      var placeret = [];
      spriteRects.filter(function (r) { return r.kind === 'fjende' && r.d <= L.sigt(st) + 2; })
        .sort(function (a, b) { return a.d - b.d; })
        .forEach(function (r) {
          var f = r.ref, x = r.x * k, y = r.y * k, w = r.w * k, h = r.h * k, farlig = trus.indexOf(f) >= 0;
          var bw = Math.max(46, Math.min(160, w * 0.7)), bh = Math.max(8, tekstStr * 0.5);
          var top = tekstStr * 1.4, under = bh + ((farlig || !f.vaagen) ? tekstStr * 1.5 : 4);
          var by = Math.max(top + 2, Math.min(y - 10, H * 0.62));
          var lx0 = x + w / 2 - Math.max(bw, tekstStr * 7) / 2, lx1 = x + w / 2 + Math.max(bw, tekstStr * 7) / 2;
          for (var n = 0; n < 6; n++) {
            var hit = placeret.filter(function (q) { return lx0 < q.x1 && q.x0 < lx1 && by - top < q.y1 && q.y0 < by + under; })[0];
            if (!hit) break;
            by = hit.y0 - under - 4;
          }
          if (by - top < 0) by = top + 2;
          placeret.push({ x0: lx0, x1: lx1, y0: by - top, y1: by + under });
          if (farlig) tg.trussel(ctx, { x: x + w * 0.1, y: Math.max(by + under, y + h * 0.05), w: w * 0.8, h: Math.max(10, Math.min(H - Math.max(by + under, y + h * 0.05) - 6, h * 0.9)), tekst: tekstStr }, s);
          tg.livbar(ctx, { x: x + w / 2, y: by, w: bw, h: bh, hp: f.hp, max: f.max, navn: L.FJENDER[f.type].navn, sover: !f.vaagen, trussel: farlig, tekst: tekstStr }, s);
        });
      // Markering af det, man peger/kigger på
      var hv = view.hover;
      if (hv && !view.kort) {
        var ts = Math.max(15, Math.min(24, W / 40));
        if (hv.rect) tg.markering(ctx, { x: hv.rect.x * k, y: Math.max(0, hv.rect.y * k), w: hv.rect.w * k, h: Math.min(H, hv.rect.h * k), tekst: hv.tekst, str: ts }, s);
        else if (hv.felt) {
          var pt = projicer(hv.felt.x + 0.5, hv.felt.y + 0.5, P, dirX, dirY, invDet, plX, plY);
          if (pt) tg.feltMarkering(ctx, { x: pt.x * k, y: pt.y * k, rx: pt.r * k * 0.9, ry: pt.r * k * 0.35, tekst: hv.tekst, str: ts }, s);
        }
      }
      // Svævende tal ("−1", "Forbi")
      svaevere.forEach(function (v) {
        var age = (now - v.t0) / 900; if (!v.statisk && age >= 1) return;
        var pt = projicer(v.x, v.y, P, dirX, dirY, invDet, plX, plY); if (!pt) return;
        tg.tal(ctx, { x: pt.x * k, y: (pt.yTop + (pt.y - pt.yTop) * 0.6) * k - (v.statisk ? 0 : age * 30), tekst: v.tekst, str: Math.max(18, Math.min(34, W / 28)), alpha: v.statisk ? 1 : 1 - age * age, ond: false }, s);
      });
      // Sigtekorn og våben
      tg.sigtekorn(ctx, { x: W / 2, y: H / 2, r: Math.max(10, Math.min(22, W / 50)), aktiv: !!view.sigter }, s);
      var sk = skudT ? (skudT.statisk ? 0.6 : Math.max(0, 1 - (now - skudT.t0) / 350)) : 0;
      tg.vaaben(ctx, { x: W * 0.62, y: H + Math.min(W, H) * 0.06, w: Math.min(W, H) * 0.42, rekyl: skudT && !skudT.statisk ? sk : 0, skud: sk }, s);
      // Skade: rolig rød tone i kanten, der langsomt forsvinder (eller står stille uden animation)
      if (skadeT) {
        var a = skadeT.statisk ? 0.5 : Math.max(0, 0.75 * (1 - (now - skadeT.t0) / 1000));
        if (a > 0) tg.skade(ctx, { w: W, h: H, styrke: a }, s);
      }
      if (view.minikort && !view.kort) tegnMinikort(st, view);
      if (view.kort) tegnKort(st, view);
    }
    // Et punkt i verden → skærm (intern opløsning)
    function projicer(wx, wy, P, dirX, dirY, invDet, plX, plY) {
      var sx = wx - cam.x, sy = wy - cam.y;
      var tX = invDet * (dirY * sx - dirX * sy), tY = invDet * (-plY * sx + plX * sy);
      if (tY < 0.2) return null;
      var x = (iw / 2) * (1 + tX / tY);
      if (x < 0 || x >= iw || tY >= zbuf[Math.floor(x)] + 0.6) return null;
      return { x: x, y: ih / 2 + 0.5 * P / tY, yTop: ih / 2 - 0.15 * P / tY, r: 0.5 * P / tY };
    }

    // ---------- Kortet (hele etagen) og minikortet ----------
    function feltType(st, i) {
      var c = st.cells[i];
      if (st.trappe && i === st.trappe.y * st.W + st.trappe.x) return 'trappe';
      if (c === L.VAEG) return 'vaeg';
      if (c === L.DOER) return 'doer';
      if (c === L.AABEN) return 'aaben';
      if (c === L.LAAST) return 'laast';
      return st.rum[i] >= 0 ? 'rum' : 'gulv';
    }
    function tegnFelter(st, ox, oy, cs, x0, y0, x1, y1, view) {
      var tg = T.tegn, W = st.W;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= st.H) continue;
        var i = y * W + x; if (!st.udforsket[i]) continue;
        var ft = feltType(st, i);
        if (ft === 'aaben') tg.kortFelt(ctx, { x: ox + (x - x0) * cs, y: oy + (y - y0) * cs, cs: cs, felt: st.rum[i] >= 0 ? 'rum' : 'gulv' }, s);
        tg.kortFelt(ctx, { x: ox + (x - x0) * cs, y: oy + (y - y0) * cs, cs: cs, felt: ft }, s);
      }
      st.ting.forEach(function (t) {
        if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1 || !st.udforsket[t.y * W + t.x]) return;
        tg.kortTing(ctx, { x: ox + (t.x - x0) * cs, y: oy + (t.y - y0) * cs, cs: cs, type: t.type }, s);
      });
      var trus = (view && view.trusler) || [];
      st.fjender.forEach(function (f) {
        if (f.x < x0 || f.x > x1 || f.y < y0 || f.y > y1 || !st.synlig[f.y * W + f.x]) return;
        tg.kortFjende(ctx, { x: ox + (f.x - x0) * cs, y: oy + (f.y - y0) * cs, cs: cs, type: f.type, trussel: trus.indexOf(f) >= 0 }, s);
      });
      var p = st.spiller;
      tg.kortSpiller(ctx, { x: ox + (p.x - x0) * cs, y: oy + (p.y - y0) * cs, cs: cs, vinkel: vinkel(p.dir) }, s);
    }
    function tegnMinikort(st, view) {
      var R = 5, n = 2 * R + 1, cs = Math.max(6, Math.floor(Math.min(cssW, cssH) * 0.22 / n));
      var size = cs * n + 8, ox = cssW - size - 8, oy = 8;
      T.tegn.kortBund(ctx, { x: ox, y: oy, w: size, h: size }, s);
      ctx.save(); ctx.beginPath(); ctx.rect(ox + 4, oy + 4, cs * n, cs * n); ctx.clip();
      var p = st.spiller;
      tegnFelter(st, ox + 4, oy + 4, cs, p.x - R, p.y - R, p.x + R, p.y + R, view);
      ctx.restore();
    }
    function tegnKort(st, view) {
      // Kortet zoomer ind på det, man har set (med en kant), så det fylder visningen
      var pad = 10, avW = cssW - 2 * pad, avH = cssH - 2 * pad - 30;
      var x0 = st.W, y0 = st.H, x1 = -1, y1 = -1;
      for (var i = 0; i < st.W * st.H; i++) if (st.udforsket[i]) { var xx = i % st.W, yy = (i / st.W) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = st.W - 1; y1 = st.H - 1; }
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(st.W - 1, x1 + 2); y1 = Math.min(st.H - 1, y1 + 2);
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      var cs = Math.max(4, Math.floor(Math.min(avW / bw, avH / bh, Math.min(cssW, cssH) / 8)));
      var ox = Math.floor((cssW - cs * bw) / 2), oy = Math.floor(30 + (cssH - 30 - cs * bh) / 2);
      var gx = ox - x0 * cs, gy = oy - y0 * cs;   // skærmposition for felt (0, 0)
      T.tegn.kortBund(ctx, { x: 0, y: 0, w: cssW, h: cssH }, s);
      tegnFelter(st, ox, oy, cs, x0, y0, x1, y1, view);
      if (view.rute && view.rute.length) {
        var pts = [{ x: gx + (st.spiller.x + 0.5) * cs, y: gy + (st.spiller.y + 0.5) * cs }];
        view.rute.forEach(function (c) { pts.push({ x: gx + (c.x + 0.5) * cs, y: gy + (c.y + 0.5) * cs }); });
        T.tegn.kortRute(ctx, { pts: pts, cs: cs }, s);
      }
      if (view.kortValg) T.tegn.kortValg(ctx, { x: gx + view.kortValg.x * cs, y: gy + view.kortValg.y * cs, cs: cs }, s);
      T.tegn.kortTekst(ctx, { tekst: view.kortTekst || 'Kort over etage ' + st.etage, x: cssW / 2, y: 18, str: Math.max(14, Math.min(22, cssW / 40)) }, s);
      kortGeo = { ox: gx, oy: gy, cs: cs };
    }

    // ---------- Peg i billedet (kig-og-gå) ----------
    function pick(px, py, kortVist) {
      var st = sidsteState; if (!st) return null;
      if (kortVist) {
        if (!kortGeo) return null;
        var mx = Math.floor((px - kortGeo.ox) / kortGeo.cs), my = Math.floor((py - kortGeo.oy) / kortGeo.cs);
        if (mx < 0 || my < 0 || mx >= st.W || my >= st.H || !st.udforsket[my * st.W + mx]) return null;
        return { type: 'felt', x: mx, y: my, kort: true };
      }
      if (!iw) return null;
      var k = iw / cssW, ix = px * k, iy = py * k;
      for (var i = spriteRects.length - 1; i >= 0; i--) {
        var r = spriteRects[i];
        if (ix >= r.vx0 - 2 && ix <= r.vx1 + 2 && iy >= r.y && iy <= r.y + r.h) {
          var rect = { x: r.vx0, y: r.y, w: r.vx1 - r.vx0 + 1, h: r.h };
          if (r.kind === 'fjende') return { type: 'fjende', x: r.cx, y: r.cy, fjende: r.ref, rect: rect };
          if (r.kind === 'trappe') return { type: 'trappe', x: r.cx, y: r.cy, rect: rect };
          return { type: 'ting', x: r.cx, y: r.cy, ting: r.ref, rect: rect };
        }
      }
      var cx = Math.max(0, Math.min(iw - 1, Math.floor(ix))), ci = colInfo[cx];
      if (!ci) return null;
      if (iy >= ci.top && iy <= ci.bot) {
        if (ci.c === L.DOER || ci.c === L.LAAST) {
          var x0 = cx, x1 = cx;
          while (x0 > 0 && colInfo[x0 - 1] && colInfo[x0 - 1].mx === ci.mx && colInfo[x0 - 1].my === ci.my) x0--;
          while (x1 < iw - 1 && colInfo[x1 + 1] && colInfo[x1 + 1].mx === ci.mx && colInfo[x1 + 1].my === ci.my) x1++;
          return { type: 'doer', x: ci.mx, y: ci.my, laast: ci.c === L.LAAST, rect: { x: x0, y: ci.top, w: x1 - x0 + 1, h: ci.bot - ci.top } };
        }
        return { type: 'felt', x: ci.fx, y: ci.fy };
      }
      // Gulv eller loft: find feltet ud fra afstanden for rækken
      var dyp = Math.abs(iy - ih / 2); if (dyp < 1) return null;
      var pl = Math.max(0.42, Math.min(0.92, 0.5 * cssW / cssH)), P = iw / (2 * pl), rowD = 0.5 * P / dyp;
      if (rowD > ci.d) return { type: 'felt', x: ci.fx, y: ci.fy };
      var dirX = Math.cos(cam.a), dirY = Math.sin(cam.a), cxx = 2 * ix / iw - 1;
      var wx = cam.x + rowD * (dirX - dirY * pl * cxx), wy = cam.y + rowD * (dirY + dirX * pl * cxx);
      return { type: 'felt', x: Math.floor(wx), y: Math.floor(wy) };
    }

    restyle();
    return {
      resize: resize, restyle: restyle, render: render, pick: pick, overgang: overgang, stoed: stoed,
      haendelser: haendelser, aktiv: aktiv, setKvalitet: setKvalitet,
      get fps() { return fpsEma; }, get renderMs() { return renderMs; }, get skala() { return skala; },
      get intern() { return { w: iw, h: ih }; }
    };
  }

  global.KaelderTegn = { create: create, installerIkoner: installerIkoner, readStyle: readStyle };
})(window);
