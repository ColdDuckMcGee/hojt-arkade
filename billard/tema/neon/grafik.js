/*
 * Billard – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/ligne-claire/grafik.js) leverer de samme navne og sætter
 * window.BillardTema. Her står INGEN farver, streger, glød, skygger eller
 * skrifttyper: alle værdier kommer fra tema.css som CSS-variabler
 * (--billard-<navn>), som tegnelaget (js/tegn.js) læser og giver videre i `s`.
 *
 * tegn.<navn>(ctx, data, s): canvas er allerede skaleret (og evt. drejet), så der
 * tegnes i bordets enheder. Spillefladen er W × H = 1000 × 500 (0,0 er hjørnet
 * inden for banderne); rammen M (= 60) går uden for den.
 *   bord(ctx, {W,H,M}, s)             træet/rammen rundt om bordet (med diamanter)
 *   filt(ctx, {W,H,M,head,foot}, s)    filten (spillefladen) med bagfeltets linje og fodpunktet
 *   hul(ctx, {x,y,r,kind}, s)          et hul (kind: 'hjoerne' eller 'midte')
 *   bande(ctx, {W,H,mc,mm}, s)         banderne med åbninger ved hullerne
 *   kugle(ctx, {x,y,r,nr,type,rot}, s) en kugle; type: 'hel', 'halv', 'otte' eller 'stoed';
 *                                      rot: drej tallet, så det står lige på skærmen
 *   maal(ctx, {x,y,r}, s)              markering af en kugle, man må ramme
 *   haand(ctx, {x,y,r}, s)             markering af stødbolden, når man har den i hånden
 *   koe(ctx, {x,y,r,aim,power}, s)     køen bag stødbolden (aim i grader, power 1–10)
 *   sigte(ctx, preview, s)             forhåndslinjen (se BillardLogik.preview)
 * s.gloed er 0, når glød er slået fra (Indstillinger → Udseende → Glød).
 * Kuglerne kan skelnes uden farver: tal på alle, stribe på de halve, sort 8'er.
 *
 * ikoner (SVG i 100 × 100, klasserne ico-line og ico-fill):
 *   drej-venstre, drej-hoejre, kraft-ned, kraft-op, stoed, naeste, flyt, pause, tilbage, pil, kugle
 */
(function (global) {
  'use strict';

  // Variabler, som tegnelaget læser fra CSS (navnet uden "--billard-")
  var FARVER = [
    'bord', 'bord-2', 'bord-kant', 'diamant', 'filt', 'filt-2', 'filt-moenster', 'linje',
    'bande', 'bande-kant', 'hul', 'hul-kant',
    'kugle-1', 'kugle-2', 'kugle-3', 'kugle-4', 'kugle-5', 'kugle-6', 'kugle-7', 'kugle-8',
    'kugle-9', 'kugle-10', 'kugle-11', 'kugle-12', 'kugle-13', 'kugle-14', 'kugle-15',
    'kugle-stoed', 'kugle-hvid', 'kugle-tal', 'kugle-tal-bund', 'kugle-kant', 'kugle-glans', 'otte-ring', 'otte-kant',
    'maal', 'haand', 'koe', 'koe-2', 'koe-spids', 'sigte', 'sigte-spoegelse', 'sigte-obj', 'sigte-stoed', 'sigte-advarsel',
    'gloed-farve', 'skygge-farve', 'kontur'
  ];
  var TEKSTER = ['skrift'];
  var TAL = [
    'otte-kant-w', 'otte-ring-w', 'otte-tal-bund-r',
    'gloed', 'gloed-blur', 'skygge-x', 'skygge-y', 'skygge-blur', 'kontur-w',
    'bord-radius', 'bord-kant-w', 'bande-w', 'bande-kant-w', 'diamant-r', 'linje-w', 'moenster-w', 'moenster-afstand',
    'hul-kant-w', 'kugle-kant-w', 'kugle-tal-str', 'kugle-tal-bund-r', 'stribe', 'glans',
    'maal-w', 'haand-w', 'sigte-w', 'sigte-prik', 'sigte-afstand', 'koe-w', 'koe-laengde', 'koe-afstand'
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
  function dots(ctx, a, b, step, rad, alphaFrom, alphaTo) {
    var L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.floor(L / step));
    for (var k = 0; k <= n; k++) {
      var f = k / n;
      ctx.globalAlpha = alphaFrom + (alphaTo - alphaFrom) * f;
      ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function arrow(ctx, from, dir, len, w, head) {
    var to = { x: from.x + dir.x * len, y: from.y + dir.y * len };
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    var px = -dir.y, py = dir.x;
    ctx.beginPath();
    ctx.moveTo(to.x - dir.x * head + px * head * 0.7, to.y - dir.y * head + py * head * 0.7);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x - dir.x * head - px * head * 0.7, to.y - dir.y * head - py * head * 0.7);
    ctx.stroke();
    return to;
  }

  var tegn = {
    bord: function (ctx, b, s) {
      var M = b.M;
      shadow(ctx, s);
      roundRect(ctx, -M, -M, b.W + 2 * M, b.H + 2 * M, s['bord-radius']);
      var g = ctx.createLinearGradient(0, -M, 0, b.H + M);
      g.addColorStop(0, s['bord']); g.addColorStop(1, s['bord-2']);
      ctx.fillStyle = g; ctx.fill();
      noFx(ctx);
      if (s['bord-kant-w'] > 0) {
        glow(ctx, s, s['bord-kant']);
        ctx.lineWidth = s['bord-kant-w']; ctx.strokeStyle = s['bord-kant'];
        roundRect(ctx, -M + s['bord-kant-w'] / 2, -M + s['bord-kant-w'] / 2, b.W + 2 * M - s['bord-kant-w'], b.H + 2 * M - s['bord-kant-w'], s['bord-radius']);
        ctx.stroke(); noFx(ctx);
      }
      roundRect(ctx, -M, -M, b.W + 2 * M, b.H + 2 * M, s['bord-radius']); kontur(ctx, s);
      // Diamanter (sigtemærker) på rammen
      var y0 = -M + (M - s['bande-w']) / 2, y1 = b.H + M - (M - s['bande-w']) / 2;
      ctx.fillStyle = s['diamant'];
      glow(ctx, s, s['diamant'], 0.5);
      for (var i = 1; i < 8; i++) {
        if (i === 4) continue;
        var x = b.W * i / 8;
        [y0, y1].forEach(function (y) { ctx.beginPath(); ctx.arc(x, y, s['diamant-r'], 0, Math.PI * 2); ctx.fill(); });
      }
      var x0 = -M + (M - s['bande-w']) / 2, x1 = b.W + M - (M - s['bande-w']) / 2;
      for (var k = 1; k < 4; k++) {
        var yy = b.H * k / 4;
        [x0, x1].forEach(function (xx) { ctx.beginPath(); ctx.arc(xx, yy, s['diamant-r'], 0, Math.PI * 2); ctx.fill(); });
      }
      noFx(ctx);
    },
    filt: function (ctx, b, s) {
      noFx(ctx);
      var bw = s['bande-w'];
      var g = ctx.createRadialGradient(b.W / 2, b.H / 2, 40, b.W / 2, b.H / 2, b.W * 0.62);
      g.addColorStop(0, s['filt']); g.addColorStop(1, s['filt-2']);
      ctx.fillStyle = g; ctx.fillRect(-bw, -bw, b.W + 2 * bw, b.H + 2 * bw);
      var d = s['moenster-afstand'];
      if (d > 0 && s['moenster-w'] > 0) {
        ctx.strokeStyle = s['filt-moenster']; ctx.lineWidth = s['moenster-w'];
        ctx.beginPath();
        for (var x = d; x < b.W; x += d) { ctx.moveTo(x, 0); ctx.lineTo(x, b.H); }
        for (var y = d; y < b.H; y += d) { ctx.moveTo(0, y); ctx.lineTo(b.W, y); }
        ctx.stroke();
      }
      // Bagfeltets linje og fodpunktet
      ctx.strokeStyle = s['linje']; ctx.lineWidth = s['linje-w'];
      ctx.setLineDash([s['linje-w'] * 3, s['linje-w'] * 4]);
      ctx.beginPath(); ctx.moveTo(b.head.x, 0); ctx.lineTo(b.head.x, b.H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = s['linje'];
      [b.head, b.foot].forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, s['linje-w'] * 1.6, 0, Math.PI * 2); ctx.fill(); });
    },
    hul: function (ctx, p, s) {
      noFx(ctx);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = s['hul']; ctx.fill();
      if (s['hul-kant-w'] > 0) {
        glow(ctx, s, s['hul-kant'], 0.7);
        ctx.lineWidth = s['hul-kant-w']; ctx.strokeStyle = s['hul-kant']; ctx.stroke();
        noFx(ctx);
      }
      kontur(ctx, s);
    },
    bande: function (ctx, b, s) {
      var bw = s['bande-w'], mc = b.mc, mm = b.mm, W = b.W, H = b.H, j = bw * 0.9;
      // Hver bande er et trapez: smallest ved filten, skrå ender ind mod hullerne
      var parts = [
        [[mc, 0], [W / 2 - mm, 0], [W / 2 - mm + j * 0.4, -bw], [mc - j * 0.2, -bw]],
        [[W / 2 + mm, 0], [W - mc, 0], [W - mc + j * 0.2, -bw], [W / 2 + mm - j * 0.4, -bw]],
        [[mc, H], [W / 2 - mm, H], [W / 2 - mm + j * 0.4, H + bw], [mc - j * 0.2, H + bw]],
        [[W / 2 + mm, H], [W - mc, H], [W - mc + j * 0.2, H + bw], [W / 2 + mm - j * 0.4, H + bw]],
        [[0, mc], [0, H - mc], [-bw, H - mc + j * 0.2], [-bw, mc - j * 0.2]],
        [[W, mc], [W, H - mc], [W + bw, H - mc + j * 0.2], [W + bw, mc - j * 0.2]]
      ];
      parts.forEach(function (q) {
        ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
        for (var i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
        ctx.closePath();
        shadow(ctx, s);
        ctx.fillStyle = s['bande']; ctx.fill();
        noFx(ctx);
        kontur(ctx, s);
        // Den lysende kant ind mod filten
        if (s['bande-kant-w'] > 0) {
          glow(ctx, s, s['bande-kant']);
          ctx.strokeStyle = s['bande-kant']; ctx.lineWidth = s['bande-kant-w']; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.stroke();
          noFx(ctx);
        }
      });
    },
    kugle: function (ctx, k, s) {
      var r = k.r, x = k.x, y = k.y, type = k.type;
      var base = type === 'stoed' ? s['kugle-stoed'] : s['kugle-' + k.nr];
      shadow(ctx, s);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = type === 'halv' ? s['kugle-hvid'] : base; ctx.fill();
      noFx(ctx);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(k.rot || 0);
      if (type === 'halv') {
        // Den farvede stribe hen over den hvide kugle
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = base; ctx.fillRect(-r, -r * s['stribe'], 2 * r, 2 * r * s['stribe']);
        ctx.restore();
      }
      if (type !== 'stoed') {
        // Tallet i en lys cirkel
        ctx.beginPath(); ctx.arc(0, 0, r * s[type === 'otte' ? 'otte-tal-bund-r' : 'kugle-tal-bund-r'], 0, Math.PI * 2);
        ctx.fillStyle = s['kugle-tal-bund']; ctx.fill();
        ctx.fillStyle = s['kugle-tal'];
        ctx.font = '700 ' + (r * s['kugle-tal-str']).toFixed(2) + 'px ' + s['skrift'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k.nr), 0, r * 0.06);
      }
      ctx.restore();
      if (type === 'otte') {
        // Den sorte 8'er: en lys kant yderst, så den skiller sig ud fra en mørk filt, og en farvet ring indenfor
        var kw = s['otte-kant-w'], rw = s['otte-ring-w'];
        if (kw > 0) {
          ctx.beginPath(); ctx.arc(x, y, r - kw * 0.5, 0, Math.PI * 2);
          ctx.lineWidth = kw; ctx.strokeStyle = s['otte-kant']; ctx.stroke();
        }
        if (rw > 0) {
          ctx.beginPath(); ctx.arc(x, y, r - kw - rw * 0.5, 0, Math.PI * 2);
          glow(ctx, s, s['otte-ring'], 0.5);
          ctx.lineWidth = rw; ctx.strokeStyle = s['otte-ring']; ctx.stroke(); noFx(ctx);
        }
      }
      // Glans
      if (s['glans'] > 0) {
        ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.38, r * s['glans'], 0, Math.PI * 2);
        ctx.fillStyle = s['kugle-glans']; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (s['kugle-kant-w'] > 0 && type !== 'otte') { ctx.lineWidth = s['kugle-kant-w']; ctx.strokeStyle = s['kugle-kant']; ctx.stroke(); }
      kontur(ctx, s);
    },
    maal: function (ctx, p, s) {
      noFx(ctx);
      ctx.strokeStyle = s['maal']; ctx.lineWidth = s['maal-w'];
      glow(ctx, s, s['maal'], 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + s['maal-w'] + 2, 0, Math.PI * 2); ctx.stroke();
      noFx(ctx);
    },
    haand: function (ctx, p, s) {
      noFx(ctx);
      ctx.strokeStyle = s['haand']; ctx.lineWidth = s['haand-w'];
      ctx.setLineDash([s['haand-w'] * 2, s['haand-w'] * 1.6]);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Fire små pile: kuglen kan flyttes
      for (var k = 0; k < 4; k++) {
        var a = k * Math.PI / 2, cx = p.x + Math.cos(a) * p.r * 2.9, cy = p.y + Math.sin(a) * p.r * 2.9;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, 0); ctx.lineTo(-4, 6); ctx.stroke();
        ctx.restore();
      }
    },
    koe: function (ctx, k, s) {
      var a = k.aim * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      var start = k.r + s['koe-afstand'] + k.power * 4, end = start + s['koe-laengde'];
      var p0 = { x: k.x - dx * start, y: k.y - dy * start }, p1 = { x: k.x - dx * end, y: k.y - dy * end };
      var w = s['koe-w'];
      shadow(ctx, s);
      var g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      g.addColorStop(0, s['koe']); g.addColorStop(1, s['koe-2']);
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      // Køen bliver lidt tykkere mod håndtaget
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.lineWidth = w * 1.5; ctx.beginPath();
      ctx.moveTo(p0.x - dx * s['koe-laengde'] * 0.55, p0.y - dy * s['koe-laengde'] * 0.55); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      noFx(ctx);
      glow(ctx, s, s['koe-spids'], 0.6);
      ctx.strokeStyle = s['koe-spids']; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0.x - dx * 10, p0.y - dy * 10); ctx.stroke();
      noFx(ctx);
      if (s['kontur-w'] > 0) {
        ctx.strokeStyle = s['kontur']; ctx.lineWidth = s['kontur-w'];
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    },
    sigte: function (ctx, v, s) {
      if (!v || !v.to) return;
      var h = v.hit || {}, step = s['sigte-afstand'], rad = s['sigte-prik'], w = s['sigte-w'];
      var warn = h.type === 'hul';
      glow(ctx, s, warn ? s['sigte-advarsel'] : s['sigte'], 0.6);
      ctx.fillStyle = warn ? s['sigte-advarsel'] : s['sigte'];
      // Fra stødbolden (uden for den) til første kollision
      var d = { x: v.to.x - v.from.x, y: v.to.y - v.from.y }, L = Math.hypot(d.x, d.y);
      if (L > 1) {
        var u = { x: d.x / L, y: d.y / L }, r0 = 16;
        if (L > r0) dots(ctx, { x: v.from.x + u.x * r0, y: v.from.y + u.y * r0 }, v.to, step, rad, 1, 1);
      }
      noFx(ctx);
      if (h.type === 'kugle') {
        // Spøgelseskuglen: hvor stødbolden rammer
        ctx.strokeStyle = s['sigte-spoegelse']; ctx.lineWidth = w * 0.6;
        ctx.beginPath(); ctx.arc(h.ghost.x, h.ghost.y, v.r, 0, Math.PI * 2); ctx.stroke();
        // Objektkuglens retning (fuld streg med pil)
        glow(ctx, s, s['sigte-obj'], 0.6);
        ctx.strokeStyle = s['sigte-obj'];
        var len = 50 + 230 * Math.max(0, h.objLen);
        arrow(ctx, { x: h.ball.x + h.obj.x * (v.r + 4), y: h.ball.y + h.obj.y * (v.r + 4) }, h.obj, len, w, 12);
        noFx(ctx);
        // Stødboldens retning bagefter (prikker)
        if (h.cue && h.cueLen > 0.08) {
          ctx.fillStyle = s['sigte-stoed'];
          var cl = 30 + 160 * h.cueLen;
          dots(ctx, { x: h.ghost.x + h.cue.x * (v.r + 6), y: h.ghost.y + h.cue.y * (v.r + 6) },
            { x: h.ghost.x + h.cue.x * cl, y: h.ghost.y + h.cue.y * cl }, step * 0.8, rad * 0.8, 0.9, 0.3);
        }
      } else if (h.type === 'bande') {
        ctx.fillStyle = s['sigte'];
        dots(ctx, v.to, { x: v.to.x + h.refl.x * 160, y: v.to.y + h.refl.y * 160 }, step, rad, 0.8, 0.2);
      } else if (warn) {
        // Stødbolden ruller i hul: et kryds
        ctx.strokeStyle = s['sigte-advarsel']; ctx.lineWidth = w; ctx.lineCap = 'round';
        var c = v.to, q = 12;
        ctx.beginPath(); ctx.moveTo(c.x - q, c.y - q); ctx.lineTo(c.x + q, c.y + q); ctx.moveTo(c.x + q, c.y - q); ctx.lineTo(c.x - q, c.y + q); ctx.stroke();
      }
      noFx(ctx);
    }
  };

  var ikoner = {
    'drej-venstre': '<path class="ico-line" d="M30 30 A28 28 0 1 1 22 58"/><path class="ico-fill" d="M14 16 L40 22 L22 42 Z"/>',
    'drej-hoejre': '<path class="ico-line" d="M70 30 A28 28 0 1 0 78 58"/><path class="ico-fill" d="M86 16 L60 22 L78 42 Z"/>',
    // Grov: stor bue med to pile. Fin: lille bue med et sigtepunkt i midten.
    'drej-venstre-grov': '<path class="ico-line" d="M30 30 A28 28 0 1 1 22 58"/><path class="ico-fill" d="M14 16 L40 22 L22 42 Z"/><path class="ico-fill" d="M4 34 L24 38 L10 54 Z"/>',
    'drej-hoejre-grov': '<path class="ico-line" d="M70 30 A28 28 0 1 0 78 58"/><path class="ico-fill" d="M86 16 L60 22 L78 42 Z"/><path class="ico-fill" d="M96 34 L76 38 L90 54 Z"/>',
    'drej-venstre-fin': '<path class="ico-line" d="M40 38 A16 16 0 1 1 36 62"/><path class="ico-fill" d="M30 28 L48 34 L36 48 Z"/><circle class="ico-fill" cx="50" cy="52" r="4"/>',
    'drej-hoejre-fin': '<path class="ico-line" d="M60 38 A16 16 0 1 0 64 62"/><path class="ico-fill" d="M70 28 L52 34 L64 48 Z"/><circle class="ico-fill" cx="50" cy="52" r="4"/>',
    'kraft-ned': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-line" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-line" x="62" y="28" width="14" height="56" rx="3"/>',
    'kraft-op': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-fill" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-fill" x="62" y="28" width="14" height="56" rx="3"/>',
    'stoed': '<path class="ico-line" d="M8 78 L52 52"/><circle class="ico-fill" cx="68" cy="42" r="13"/><path class="ico-line" d="M84 18 L92 10 M88 32 L97 30 M72 16 L74 6"/>',
    'naeste': '<circle class="ico-line" cx="34" cy="50" r="18"/><circle class="ico-fill" cx="34" cy="50" r="6"/><path class="ico-line" d="M60 50 H90 M78 36 L92 50 L78 64"/>',
    'flyt': '<circle class="ico-fill" cx="50" cy="50" r="13"/><path class="ico-line" d="M50 8 V26 M42 16 L50 8 L58 16 M50 92 V74 M42 84 L50 92 L58 84 M8 50 H26 M16 42 L8 50 L16 58 M92 50 H74 M84 42 L92 50 L84 58"/>',
    'pause': '<rect class="ico-fill" x="26" y="20" width="16" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="16" height="60" rx="4"/>',
    'tilbage': '<path class="ico-line" d="M44 22 L16 50 L44 78 M18 50 H84"/>',
    'pil': '<path class="ico-fill" d="M50 8 L76 52 H58 V92 H42 V52 H24 Z"/>',
    'kugle': '<circle class="ico-fill" cx="50" cy="50" r="30"/>'
  };

  global.BillardTema = { navn: 'neon', farver: FARVER, tekster: TEKSTER, tal: TAL, tegn: tegn, ikoner: ikoner };
})(typeof window !== 'undefined' ? window : globalThis);
