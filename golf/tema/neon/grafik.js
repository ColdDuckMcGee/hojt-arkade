/*
 * Golf – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.GolfTema. Her står INGEN farver, streger, glød eller skygger: alle
 * værdier kommer fra tema.css som CSS-variabler (--golf-<navn>), som tegnelaget
 * (js/tegn.js) læser og giver videre i objektet `s`.
 *
 * tegn.<navn>(ctx, data, s): canvas er allerede skaleret (og evt. drejet), så der
 * tegnes i banens enheder (banen er W × H = 1000 × 600). Tegnefunktionerne:
 *   flade(ctx, {W,H}, s)          græsset (hele banen)
 *   sand(ctx, {x,y,w,h}, s)       sandfelt
 *   vand(ctx, {x,y,w,h}, s)       vandhul (strafslag)
 *   skraaning(ctx, {x,y,w,h,dir}, s)  skråning; dir i grader (0 = mod højre, 90 = nedad)
 *   bande(ctx, {ax,ay,bx,by,t}, s)    væg/bande inde på banen (tyk linje med runde ender)
 *   kant(ctx, {W,H}, s)           yderbanden rundt om banen
 *   tee(ctx, {x,y}, s)            startfeltet
 *   hul(ctx, {x,y,r}, s)          hullet
 *   flag(ctx, {x,y,r}, s)         flaget i hullet
 *   spor(ctx, [{x,y}], s)         det forrige slags spor
 *   sigte(ctx, {pts, full}, s)    forhåndslinjen (full = hele banen vises)
 *   slutpunkt(ctx, {x,y,r}, s)    hvor bolden stopper (kun når hele banen vises)
 *   bold(ctx, {x,y,r}, s)         bolden
 * s.gloed er 0, når glød er slået fra (Indstillinger → Udseende → Glød).
 *
 * ikoner (SVG i 100 × 100, klasserne ico-line og ico-fill):
 *   drej-venstre, drej-hoejre, kraft-ned, kraft-op, slaa, pause, tilbage, flag, bold,
 *   pil (retningsviseren; peger op i grundstilling)
 */
(function (global) {
  'use strict';

  // Variabler, som tegnelaget læser fra CSS (navnet uden "--golf-")
  var FARVER = [
    'flade', 'flade-2', 'flade-moenster', 'kant', 'kant-inde', 'bande', 'bande-kerne', 'kontur',
    'sand', 'sand-moenster', 'vand', 'vand-boelge', 'skraaning', 'skraaning-pil',
    'tee', 'tee-kant', 'hul', 'hul-kant', 'flag', 'flagstang', 'bold', 'bold-kant',
    'sigte', 'sigte-pil', 'spor', 'slutpunkt', 'gloed-farve', 'skygge-farve'
  ];
  var TAL = [
    'gloed', 'gloed-blur', 'skygge-x', 'skygge-y', 'skygge-blur',
    'kant-w', 'kontur-w', 'bande-kerne-w', 'moenster-w', 'moenster-afstand', 'sigte-w', 'sigte-prik', 'sigte-afstand',
    'spor-w', 'flag-w', 'radius-felt', 'hul-kant-w', 'boelge-w', 'pil-w', 'tee-kant-w', 'bold-kant-w', 'kant-inde-w'
  ];

  function glow(ctx, s, color, k) {
    var b = s['gloed'] * s['gloed-blur'] * (k || 1);
    ctx.shadowColor = b > 0 ? (color || s['gloed-farve']) : 'transparent';
    ctx.shadowBlur = b; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
  function shadow(ctx, s) {
    ctx.shadowColor = s['skygge-farve']; ctx.shadowBlur = s['skygge-blur'];
    ctx.shadowOffsetX = s['skygge-x']; ctx.shadowOffsetY = s['skygge-y'];
  }
  function noFx(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function kontur(ctx, s) {
    if (s['kontur-w'] > 0) { noFx(ctx); ctx.lineWidth = s['kontur-w']; ctx.strokeStyle = s['kontur']; ctx.stroke(); }
  }

  var tegn = {
    flade: function (ctx, b, s) {
      noFx(ctx);
      var g = ctx.createLinearGradient(0, 0, b.W, b.H);
      g.addColorStop(0, s['flade']); g.addColorStop(1, s['flade-2']);
      ctx.fillStyle = g; ctx.fillRect(0, 0, b.W, b.H);
      // Svagt gitter (synthwave-gulv)
      var d = s['moenster-afstand'];
      if (d > 0 && s['moenster-w'] > 0) {
        ctx.strokeStyle = s['flade-moenster']; ctx.lineWidth = s['moenster-w'];
        ctx.beginPath();
        for (var x = d; x < b.W; x += d) { ctx.moveTo(x, 0); ctx.lineTo(x, b.H); }
        for (var y = d; y < b.H; y += d) { ctx.moveTo(0, y); ctx.lineTo(b.W, y); }
        ctx.stroke();
      }
    },
    sand: function (ctx, z, s) {
      shadow(ctx, s);
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']);
      ctx.fillStyle = s['sand']; ctx.fill();
      noFx(ctx);
      // Prikker
      ctx.save(); roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); ctx.clip();
      ctx.fillStyle = s['sand-moenster'];
      for (var y = z.y + 8, row = 0; y < z.y + z.h; y += 14, row++)
        for (var x = z.x + 6 + (row % 2) * 7; x < z.x + z.w; x += 14) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); kontur(ctx, s);
    },
    vand: function (ctx, z, s) {
      shadow(ctx, s);
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']);
      ctx.fillStyle = s['vand']; ctx.fill();
      noFx(ctx);
      ctx.save(); roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); ctx.clip();
      ctx.strokeStyle = s['vand-boelge']; ctx.lineWidth = s['boelge-w']; ctx.lineCap = 'round';
      glow(ctx, s, s['vand-boelge'], 0.5);
      for (var y = z.y + 18; y < z.y + z.h - 6; y += 22) {
        ctx.beginPath();
        for (var x = z.x + 10; x < z.x + z.w - 10; x += 24) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 5, x + 12, y); ctx.quadraticCurveTo(x + 18, y + 5, x + 24, y); }
        ctx.stroke();
      }
      ctx.restore(); noFx(ctx);
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); kontur(ctx, s);
    },
    skraaning: function (ctx, z, s) {
      noFx(ctx);
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']);
      ctx.fillStyle = s['skraaning']; ctx.fill();
      ctx.save(); roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); ctx.clip();
      // Vinkler (chevrons), der peger ned ad skråningen
      ctx.strokeStyle = s['skraaning-pil']; ctx.lineWidth = s['pil-w']; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var a = z.dir * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      for (var y = z.y + 28; y < z.y + z.h; y += 46) for (var x = z.x + 28; x < z.x + z.w; x += 46) {
        ctx.save(); ctx.translate(x, y); ctx.transform(ca, sa, -sa, ca, 0, 0);
        ctx.beginPath(); ctx.moveTo(-6, -11); ctx.lineTo(6, 0); ctx.lineTo(-6, 11); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      roundRect(ctx, z.x, z.y, z.w, z.h, s['radius-felt']); kontur(ctx, s);
    },
    bande: function (ctx, w, s) {
      ctx.lineCap = 'round';
      // Kontur under (tegneserie/papir) og selve banden
      if (s['kontur-w'] > 0) {
        noFx(ctx); ctx.strokeStyle = s['kontur']; ctx.lineWidth = w.t + 2 * s['kontur-w'];
        ctx.beginPath(); ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); ctx.stroke();
      }
      shadow(ctx, s);
      ctx.strokeStyle = s['bande']; ctx.lineWidth = w.t;
      ctx.beginPath(); ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); ctx.stroke();
      glow(ctx, s, s['bande-kerne']);
      if (s['bande-kerne-w'] > 0) {
        ctx.strokeStyle = s['bande-kerne']; ctx.lineWidth = s['bande-kerne-w'];
        ctx.beginPath(); ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); ctx.stroke();
      }
      noFx(ctx);
    },
    kant: function (ctx, b, s) {
      var k = s['kant-w'];
      glow(ctx, s, s['kant']);
      ctx.strokeStyle = s['kant']; ctx.lineWidth = k; ctx.lineJoin = 'round';
      ctx.strokeRect(-k / 2, -k / 2, b.W + k, b.H + k);
      noFx(ctx);
      ctx.strokeStyle = s['kant-inde']; ctx.lineWidth = s['kant-inde-w'];
      ctx.strokeRect(k / 4, k / 4, b.W - k / 2, b.H - k / 2);
      if (s['kontur-w'] > 0) { ctx.strokeStyle = s['kontur']; ctx.lineWidth = s['kontur-w']; ctx.strokeRect(-k, -k, b.W + 2 * k, b.H + 2 * k); }
    },
    tee: function (ctx, p, s) {
      noFx(ctx);
      roundRect(ctx, p.x - 26, p.y - 26, 52, 52, s['radius-felt']);
      ctx.fillStyle = s['tee']; ctx.fill();
      ctx.lineWidth = s['tee-kant-w']; ctx.strokeStyle = s['tee-kant']; ctx.stroke();
    },
    hul: function (ctx, p, s) {
      glow(ctx, s, s['hul-kant']);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = s['hul']; ctx.fill();
      ctx.lineWidth = s['hul-kant-w']; ctx.strokeStyle = s['hul-kant']; ctx.stroke();
      noFx(ctx);
    },
    flag: function (ctx, p, s) {
      noFx(ctx);
      ctx.lineCap = 'round';
      ctx.strokeStyle = s['flagstang']; ctx.lineWidth = s['flag-w'];
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 58); ctx.stroke();
      glow(ctx, s, s['flag']);
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 58); ctx.lineTo(p.x + 34, p.y - 47); ctx.lineTo(p.x, p.y - 36); ctx.closePath();
      ctx.fillStyle = s['flag']; ctx.fill();
      noFx(ctx);
      if (s['kontur-w'] > 0) { ctx.lineWidth = s['kontur-w']; ctx.strokeStyle = s['kontur']; ctx.stroke(); }
    },
    spor: function (ctx, pts, s) {
      if (!pts || pts.length < 2) return;
      noFx(ctx);
      ctx.strokeStyle = s['spor']; ctx.lineWidth = s['spor-w']; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([s['spor-w'] * 2, s['spor-w'] * 3]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); ctx.setLineDash([]);
    },
    sigte: function (ctx, v, s) {
      var pts = v.pts;
      if (!pts || pts.length < 2) return;
      // Prikker med fast afstand langs linjen
      var step = s['sigte-afstand'], next = step * 0.6, total = 0;
      glow(ctx, s, s['sigte'], 0.6);
      ctx.fillStyle = s['sigte'];
      var dots = [];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
        while (next <= total + L) { var f = (next - total) / (L || 1); dots.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }); next += step; }
        total += L;
      }
      var n = dots.length;
      for (var k = 0; k < n; k++) {
        // Den korte linje bliver svagere mod enden (den fortsætter, men vises ikke)
        ctx.globalAlpha = v.full ? 1 : Math.max(0.25, 1 - 0.75 * k / Math.max(1, n - 1));
        ctx.beginPath(); ctx.arc(dots[k].x, dots[k].y, s['sigte-prik'], 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Pil ved bolden i slagets retning
      var p0 = pts[0], p1 = pts[Math.min(pts.length - 1, 6)];
      var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      ctx.save(); ctx.translate(p0.x, p0.y); ctx.rotate(ang);
      ctx.strokeStyle = s['sigte-pil']; ctx.lineWidth = s['sigte-w']; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      glow(ctx, s, s['sigte-pil']);
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(54, 0); ctx.moveTo(42, -11); ctx.lineTo(55, 0); ctx.lineTo(42, 11); ctx.stroke();
      ctx.restore(); noFx(ctx);
    },
    slutpunkt: function (ctx, p, s) {
      noFx(ctx);
      ctx.strokeStyle = s['slutpunkt']; ctx.lineWidth = s['sigte-w'];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - p.r - 12, p.y); ctx.lineTo(p.x - p.r - 2, p.y); ctx.moveTo(p.x + p.r + 2, p.y); ctx.lineTo(p.x + p.r + 12, p.y);
      ctx.moveTo(p.x, p.y - p.r - 12); ctx.lineTo(p.x, p.y - p.r - 2); ctx.moveTo(p.x, p.y + p.r + 2); ctx.lineTo(p.x, p.y + p.r + 12); ctx.stroke();
    },
    bold: function (ctx, p, s) {
      shadow(ctx, s);
      glow(ctx, s, s['bold'], 0.8);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = s['bold']; ctx.fill();
      noFx(ctx);
      if (s['bold-kant-w'] > 0) { ctx.lineWidth = s['bold-kant-w']; ctx.strokeStyle = s['bold-kant']; ctx.stroke(); }
    }
  };

  var ikoner = {
    'drej-venstre': '<path class="ico-line" d="M30 30 A28 28 0 1 1 22 58"/><path class="ico-fill" d="M14 16 L40 22 L22 42 Z"/>',
    'drej-hoejre': '<path class="ico-line" d="M70 30 A28 28 0 1 0 78 58"/><path class="ico-fill" d="M86 16 L60 22 L78 42 Z"/>',
    'kraft-ned': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-line" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-line" x="62" y="28" width="14" height="56" rx="3"/>',
    'kraft-op': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-fill" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-fill" x="62" y="28" width="14" height="56" rx="3"/>',
    'slaa': '<path class="ico-line" d="M22 14 L52 64"/><path class="ico-fill" d="M44 60 L66 56 L70 70 L48 76 Z"/><circle class="ico-fill" cx="78" cy="80" r="9"/>',
    'pause': '<rect class="ico-fill" x="26" y="20" width="16" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="16" height="60" rx="4"/>',
    'tilbage': '<path class="ico-line" d="M44 22 L16 50 L44 78 M18 50 H84"/>',
    'flag': '<path class="ico-line" d="M32 88 V12"/><path class="ico-fill" d="M34 14 L80 28 L34 44 Z"/><ellipse class="ico-line" cx="32" cy="88" rx="18" ry="5"/>',
    'bold': '<circle class="ico-fill" cx="50" cy="50" r="30"/>',
    'pil': '<path class="ico-fill" d="M50 8 L76 52 H58 V92 H42 V52 H24 Z"/>'
  };

  global.GolfTema = { navn: 'neon', farver: FARVER, tal: TAL, tegn: tegn, ikoner: ikoner };
})(typeof window !== 'undefined' ? window : globalThis);
