/*
 * Muren – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.MurenTema. Her står INGEN farver, streger, glød, skygger eller skrifttyper:
 * alle værdier kommer fra tema.css som CSS-variabler (--muren-<navn>), som
 * tegnelaget (js/tegn.js) læser og giver videre i objektet `s`.
 *
 * tegn.<navn>(ctx, data, s): canvas er allerede skaleret, så der tegnes i
 * brættets enheder (W × H = 700 × 1000, felter à 100). Tegnefunktionerne:
 *   flade(ctx, {W,H,cell}, s)           baggrunden på brættet
 *   bundlinje(ctx, {W,H,y}, s)          farezonen nederst (række 9); y = dens overkant
 *   kant(ctx, {W,H}, s)                 rammen rundt om brættet
 *   sten(ctx, {x,y,w,h,n,tone}, s)      en murstén med sit tal n; tone 0–4 (svag → stærk)
 *   ring(ctx, {x,y,r}, s)               "+1 kugle"-ring
 *   sigte(ctx, {pts}, s)                sigtelinjen (prikker) til første flade og ét hop videre
 *   traef(ctx, {x,y,r}, s)              markering, hvor sigtelinjen rammer først
 *   kanon(ctx, {x,y,a,r}, s)            kanonen; a = vinkel i grader (0 = op, + = mod højre)
 *   antal(ctx, {x,y,n}, s)              "×n" ved kanonen (kugler tilbage i salven)
 *   landing(ctx, {x,y,r}, s)            hvor næste salve skydes fra (første kugle, der landede)
 *   kugle(ctx, {x,y,r}, s)              en kugle
 * s.gloed er 0, når glød er slået fra (Indstillinger → Udseende → Glød).
 *
 * ikoner (SVG i 100 × 100, klasserne ico-line og ico-fill):
 *   drej-venstre, drej-hoejre, fin-venstre, fin-hoejre, skyd, spring, pause, tilbage, pil
 */
(function (global) {
  'use strict';

  // Variabler, som tegnelaget læser fra CSS (navnet uden "--muren-")
  var FARVER = [
    'flade', 'flade-2', 'gitter', 'kant', 'kant-inde', 'kontur', 'fare', 'fare-streg',
    'sten-0', 'sten-1', 'sten-2', 'sten-3', 'sten-4', 'sten-kant', 'sten-lys', 'sten-tal', 'sten-tal-kant',
    'ring', 'ring-tekst', 'kugle', 'kugle-kant', 'kanon', 'kanon-kant', 'antal', 'antal-kant',
    'sigte', 'traef', 'landing', 'gloed-farve', 'skygge-farve'
  ];
  var TEKSTER = ['skrift', 'skrift-vaegt'];
  var TAL = [
    'gloed', 'gloed-blur', 'skygge-x', 'skygge-y', 'skygge-blur',
    'kant-w', 'kant-inde-w', 'kontur-w', 'gitter-w', 'sten-kant-w', 'sten-radius', 'sten-tal-kant-w', 'sten-tal-str',
    'ring-w', 'kugle-kant-w', 'sigte-prik', 'sigte-afstand', 'traef-w', 'kanon-w', 'fare-w'
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
  // Tekst med kraftig kant, så tallene kan læses på alle baggrunde
  function label(ctx, txt, x, y, size, s, fill, edge) {
    noFx(ctx);
    ctx.font = s['skrift-vaegt'] + ' ' + size + 'px ' + s['skrift'];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s['sten-tal-kant-w'] > 0) {
      ctx.lineJoin = 'round'; ctx.lineWidth = s['sten-tal-kant-w']; ctx.strokeStyle = edge;
      ctx.strokeText(txt, x, y);
    }
    ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }

  var tegn = {
    flade: function (ctx, b, s) {
      noFx(ctx);
      var g = ctx.createLinearGradient(0, 0, 0, b.H);
      g.addColorStop(0, s['flade']); g.addColorStop(1, s['flade-2']);
      ctx.fillStyle = g; ctx.fillRect(0, 0, b.W, b.H);
      if (s['gitter-w'] > 0) {
        ctx.strokeStyle = s['gitter']; ctx.lineWidth = s['gitter-w'];
        ctx.beginPath();
        for (var x = b.cell; x < b.W; x += b.cell) { ctx.moveTo(x, 0); ctx.lineTo(x, b.H); }
        for (var y = b.cell; y < b.H; y += b.cell) { ctx.moveTo(0, y); ctx.lineTo(b.W, y); }
        ctx.stroke();
      }
    },
    bundlinje: function (ctx, z, s) {
      noFx(ctx);
      ctx.fillStyle = s['fare']; ctx.fillRect(0, z.y, z.W, z.H - z.y);
      // Skrå striber (stillestående) og en tydelig linje i overkanten
      ctx.save(); ctx.beginPath(); ctx.rect(0, z.y, z.W, z.H - z.y); ctx.clip();
      ctx.strokeStyle = s['fare-streg']; ctx.lineWidth = s['fare-w'] * 0.5; ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (var x = -100; x < z.W + 100; x += 40) { ctx.moveTo(x, z.H); ctx.lineTo(x + 100, z.y); }
      ctx.stroke(); ctx.restore();
      glow(ctx, s, s['fare-streg'], 0.6);
      ctx.strokeStyle = s['fare-streg']; ctx.lineWidth = s['fare-w'];
      ctx.setLineDash([s['fare-w'] * 4, s['fare-w'] * 2.5]);
      ctx.beginPath(); ctx.moveTo(0, z.y); ctx.lineTo(z.W, z.y); ctx.stroke();
      ctx.setLineDash([]); noFx(ctx);
    },
    kant: function (ctx, b, s) {
      var k = s['kant-w'];
      glow(ctx, s, s['kant']);
      ctx.strokeStyle = s['kant']; ctx.lineWidth = k; ctx.lineJoin = 'round';
      ctx.strokeRect(-k / 2, -k / 2, b.W + k, b.H + k);
      noFx(ctx);
      if (s['kant-inde-w'] > 0) { ctx.strokeStyle = s['kant-inde']; ctx.lineWidth = s['kant-inde-w']; ctx.strokeRect(k / 4, k / 4, b.W - k / 2, b.H - k / 2); }
      if (s['kontur-w'] > 0) { ctx.strokeStyle = s['kontur']; ctx.lineWidth = s['kontur-w']; ctx.strokeRect(-k, -k, b.W + 2 * k, b.H + 2 * k); }
    },
    sten: function (ctx, b, s) {
      var col = s['sten-' + Math.max(0, Math.min(4, b.tone))];
      shadow(ctx, s);
      glow(ctx, s, col, 0.55);
      roundRect(ctx, b.x, b.y, b.w, b.h, s['sten-radius']);
      ctx.fillStyle = col; ctx.fill();
      noFx(ctx);
      // Lys kant øverst (glas) og selve kanten
      ctx.save(); roundRect(ctx, b.x, b.y, b.w, b.h, s['sten-radius']); ctx.clip();
      ctx.fillStyle = s['sten-lys']; ctx.fillRect(b.x, b.y, b.w, b.h * 0.18);
      ctx.restore();
      if (s['sten-kant-w'] > 0) { roundRect(ctx, b.x, b.y, b.w, b.h, s['sten-radius']); ctx.lineWidth = s['sten-kant-w']; ctx.strokeStyle = s['sten-kant']; ctx.stroke(); }
      roundRect(ctx, b.x, b.y, b.w, b.h, s['sten-radius']); kontur(ctx, s);
      var txt = String(b.n), digits = txt.length;
      var size = s['sten-tal-str'] * (digits <= 2 ? 1 : digits === 3 ? 0.8 : 0.64);
      label(ctx, txt, b.x + b.w / 2, b.y + b.h / 2 + size * 0.04, size, s, s['sten-tal'], s['sten-tal-kant']);
    },
    ring: function (ctx, p, s) {
      glow(ctx, s, s['ring'], 0.7);
      ctx.strokeStyle = s['ring']; ctx.lineWidth = s['ring-w'];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      noFx(ctx);
      if (s['kontur-w'] > 0) { ctx.strokeStyle = s['kontur']; ctx.lineWidth = s['kontur-w']; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + s['ring-w'] / 2, 0, Math.PI * 2); ctx.stroke(); }
      label(ctx, '+1', p.x, p.y + 1, p.r * 0.95, s, s['ring-tekst'], s['sten-tal-kant']);
    },
    sigte: function (ctx, v, s) {
      var pts = v.pts;
      if (!pts || pts.length < 2) return;
      var step = s['sigte-afstand'], next = step * 0.8, total = 0, dots = [];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
        while (next <= total + L) { var f = (next - total) / (L || 1); dots.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: i }); next += step; }
        total += L;
      }
      glow(ctx, s, s['sigte'], 0.5);
      ctx.fillStyle = s['sigte'];
      dots.forEach(function (d) {
        // Efter hoppet: lidt mindre prikker
        var r = d.seg === 1 ? s['sigte-prik'] : s['sigte-prik'] * 0.7;
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
      });
      noFx(ctx);
    },
    traef: function (ctx, p, s) {
      noFx(ctx);
      ctx.strokeStyle = s['traef']; ctx.lineWidth = s['traef-w'];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, Math.PI * 2); ctx.stroke();
    },
    kanon: function (ctx, p, s) {
      var a = p.a * Math.PI / 180;
      shadow(ctx, s);
      glow(ctx, s, s['kanon'], 0.6);
      // Løbet
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      roundRect(ctx, -s['kanon-w'] / 2, -p.r * 3.4, s['kanon-w'], p.r * 3.4, s['kanon-w'] / 3);
      ctx.fillStyle = s['kanon']; ctx.fill();
      noFx(ctx);
      if (s['kugle-kant-w'] > 0) { ctx.lineWidth = s['kugle-kant-w']; ctx.strokeStyle = s['kanon-kant']; ctx.stroke(); }
      kontur(ctx, s);
      ctx.restore();
      // Foden (halvkugle på gulvet)
      shadow(ctx, s);
      ctx.beginPath(); ctx.arc(p.x, p.y + p.r, p.r * 2.1, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = s['kanon']; ctx.fill();
      noFx(ctx);
      if (s['kugle-kant-w'] > 0) { ctx.lineWidth = s['kugle-kant-w']; ctx.strokeStyle = s['kanon-kant']; ctx.stroke(); }
      kontur(ctx, s);
    },
    antal: function (ctx, p, s) {
      label(ctx, '×' + p.n, p.x, p.y, 34, s, s['antal'], s['antal-kant']);
    },
    landing: function (ctx, p, s) {
      noFx(ctx);
      ctx.strokeStyle = s['landing']; ctx.lineWidth = s['traef-w'];
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, Math.PI, 0); ctx.stroke();
      ctx.setLineDash([]);
    },
    kugle: function (ctx, p, s) {
      shadow(ctx, s);
      glow(ctx, s, s['kugle'], 0.7);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = s['kugle']; ctx.fill();
      noFx(ctx);
      if (s['kugle-kant-w'] > 0) { ctx.lineWidth = s['kugle-kant-w']; ctx.strokeStyle = s['kugle-kant']; ctx.stroke(); }
    }
  };

  var ikoner = {
    'drej-venstre': '<path class="ico-line" d="M30 30 A28 28 0 1 1 22 58"/><path class="ico-fill" d="M14 16 L40 22 L22 42 Z"/>',
    'drej-hoejre': '<path class="ico-line" d="M70 30 A28 28 0 1 0 78 58"/><path class="ico-fill" d="M86 16 L60 22 L78 42 Z"/>',
    'fin-venstre': '<circle class="ico-fill" cx="50" cy="82" r="8"/><path class="ico-line" d="M50 82 L40 42"/><path class="ico-line" d="M72 28 A36 36 0 0 0 38 18"/><path class="ico-fill" d="M22 18 L40 8 L40 30 Z"/>',
    'fin-hoejre': '<circle class="ico-fill" cx="50" cy="82" r="8"/><path class="ico-line" d="M50 82 L60 42"/><path class="ico-line" d="M28 28 A36 36 0 0 1 62 18"/><path class="ico-fill" d="M78 18 L60 8 L60 30 Z"/>',
    'skyd': '<circle class="ico-fill" cx="50" cy="22" r="9"/><circle class="ico-fill" cx="50" cy="44" r="7"/><path class="ico-line" d="M50 60 V70"/><path class="ico-fill" d="M22 90 A28 22 0 0 1 78 90 Z"/>',
    'spring': '<path class="ico-fill" d="M14 22 L44 50 L14 78 Z"/><path class="ico-fill" d="M46 22 L76 50 L46 78 Z"/><rect class="ico-fill" x="78" y="22" width="10" height="56" rx="3"/>',
    'pause': '<rect class="ico-fill" x="26" y="20" width="16" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="16" height="60" rx="4"/>',
    'tilbage': '<path class="ico-line" d="M44 22 L16 50 L44 78 M18 50 H84"/>',
    'pil': '<path class="ico-fill" d="M50 8 L76 52 H58 V92 H42 V52 H24 Z"/>'
  };

  // Lyde: neon bruger spillets egne standardlyde (js/lyd.js). Et andet tema kan give
  // enkelte lyde en anden klang: lyde: { knust: function (t, n, v) { v.tone(…); } }.
  var lyde = {};

  global.MurenTema = { navn: 'neon', farver: FARVER, tekster: TEKSTER, tal: TAL, tegn: tegn, ikoner: ikoner, lyde: lyde };
})(typeof window !== 'undefined' ? window : globalThis);
