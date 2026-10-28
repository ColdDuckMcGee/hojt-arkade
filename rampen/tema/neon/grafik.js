/*
 * Rampen – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.RampenTema. Her står INGEN farver, streger, glød eller skygger: alle
 * værdier kommer fra tema.css som CSS-variabler (--rampen-<navn>), som
 * tegnelaget (js/tegn.js) læser og giver videre i objektet `s`.
 *
 * Alle tegnefunktioner tegner i skærmens px. `v` er udsnittet:
 *   v.w, v.h      canvas i px          v.k       px pr. meter
 *   v.sx(x)       skærm-x for x meter  v.sy(y)   skærm-y for y meter over jorden
 *   v.x0, v.x1    synlige meter        v.zone    zonen midt i billedet
 *
 * tegn.<navn>(ctx, data, v, s):
 *   himmel(ctx, {zone, naeste, blend}, v, s)    himlen (zonen og evt. overgang til den næste)
 *   kulisse(ctx, {zone}, v, s)                  baggrund langt væk (huse, klitter, bjerge, skyer, stjerner)
 *   jord(ctx, {zone}, v, s)                     jorden (vandret ved y = 0)
 *   maaler(ctx, {x, tekst}, v, s)               afstandsmærke på jorden (hver 50. m)
 *   milepael(ctx, {x, navn}, v, s)              zonegrænse med navn
 *   startrampe(ctx, {h, len, vinkel}, v, s)     rampen, bilen sendes ud fra (x = 0)
 *   ting: trampolin, rampe, olie, sten, kaktus, kegle, ballon, vind, moent, bonus
 *         (ctx, o, v, s) – o er tingen fra logikken (x, y, w, h eller r i meter, zone)
 *   bil(ctx, {x, y, vinkel, type, vinger, raket, flamme, skaerm, naese}, v, s)
 *         type: saebekasse | folkevogn | sportsvogn | raketbil (fra sæbekassebil til raketbil)
 *   spor(ctx, pts, v, s)                        bilens vej indtil nu
 *   forhaand(ctx, {pts, slags}, v, s)           forhåndslinje; slags: 'uden' | 'med' (boost) | 'start'
 *   landing(ctx, {x, tekst, slags}, v, s)       hvor bilen lander, med afstand
 * s.gloed er 0, når glød er slået fra (Indstillinger → Udseende → Glød).
 *
 * ikoner (SVG i 100 × 100, klasserne ico-line og ico-fill): se `ikoner` nederst.
 */
(function (global) {
  'use strict';

  var ZONER = ['forstad', 'oerken', 'bjerge', 'skyer', 'rummet'];
  var BILER = ['saebekasse', 'folkevogn', 'sportsvogn', 'raketbil'];
  var FARVER = ['kontur', 'gloed-farve', 'skygge-farve', 'tekst', 'tekst-kant',
    'maaler', 'milepael', 'rampe', 'rampe-kant',
    'trampolin', 'trampolin-dug', 'rampe-ting', 'olie', 'sten', 'sten-kant', 'kaktus', 'kegle', 'kegle-stribe',
    'ballon', 'ballon-snor', 'vind', 'moent', 'moent-kant', 'bonus', 'bonus-kant',
    'bil-krop', 'bil-krop-2', 'bil-kant', 'bil-rude', 'hjul', 'hjul-nav', 'vinge', 'raket', 'flamme', 'flamme-kerne', 'skaerm', 'skaerm-snor',
    'spor', 'forhaand-uden', 'forhaand-med', 'forhaand-start', 'landing'];
  ZONER.forEach(function (z) { FARVER.push('himmel-' + z + '-1', 'himmel-' + z + '-2', 'jord-' + z, 'jord-' + z + '-kant', 'kulisse-' + z, 'kulisse-' + z + '-2'); });
  var TAL = ['gloed', 'gloed-blur', 'skygge-x', 'skygge-y', 'skygge-blur', 'kontur-w', 'streg-w', 'forhaand-w', 'spor-w', 'jord-kant-w', 'tekst-str', 'radius'];

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
  function kontur(ctx, s, w) { if (s['kontur-w'] > 0) { noFx(ctx); ctx.lineWidth = w || s['kontur-w']; ctx.strokeStyle = s['kontur']; ctx.stroke(); } }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function tekst(ctx, t, x, y, s, align, size) {
    noFx(ctx);
    ctx.font = '700 ' + Math.round(size || s['tekst-str']) + 'px ' + s.font;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = s['tekst-kant']; ctx.strokeText(t, x, y);
    ctx.fillStyle = s['tekst']; ctx.fillText(t, x, y);
  }
  // Mindste størrelse på små ting, så de kan ses, når billedet er zoomet ud
  function px(v, m, min) { return Math.max(m * v.k, min); }
  // Fast "tilfældig" værdi pr. heltal (kulisser)
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function mix(a, b, f) { return f <= 0 ? a : f >= 1 ? b : null; }

  var tegn = {
    himmel: function (ctx, d, v, s) {
      noFx(ctx);
      var g = ctx.createLinearGradient(0, 0, 0, v.h);
      g.addColorStop(0, s['himmel-' + d.zone + '-1']); g.addColorStop(1, s['himmel-' + d.zone + '-2']);
      ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
      if (d.naeste && d.blend > 0) {
        ctx.globalAlpha = d.blend;
        var g2 = ctx.createLinearGradient(0, 0, 0, v.h);
        g2.addColorStop(0, s['himmel-' + d.naeste + '-1']); g2.addColorStop(1, s['himmel-' + d.naeste + '-2']);
        ctx.fillStyle = g2; ctx.fillRect(0, 0, v.w, v.h);
        ctx.globalAlpha = 1;
      }
    },
    kulisse: function (ctx, d, v, s) {
      noFx(ctx);
      var z = d.zone, base = v.sy(0), par = 0.25;     // bevæger sig langsommere end jorden
      var off = v.x0 * v.k * par, c1 = s['kulisse-' + z], c2 = s['kulisse-' + z + '-2'];
      var step = 90, i0 = Math.floor(off / step) - 1, i1 = i0 + Math.ceil(v.w / step) + 3;
      for (var i = i0; i < i1; i++) {
        var x = i * step - off, r = rnd(i), h;
        ctx.fillStyle = c1; ctx.strokeStyle = c2; ctx.lineWidth = s['streg-w'];
        if (z === 'forstad') {        // huse med tag og et oplyst vindue
          h = 40 + r * 60; var w = 50 + r * 30;
          ctx.beginPath(); ctx.rect(x, base - h, w, h); ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w / 2, base - h - 28); ctx.lineTo(x + w + 6, base - h); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = c2; ctx.fillRect(x + w * 0.3, base - h * 0.7, 12, 12);
        } else if (z === 'oerken') {  // klitter
          h = 30 + r * 50;
          ctx.beginPath(); ctx.moveTo(x - 60, base); ctx.quadraticCurveTo(x + 30, base - h * 2, x + 120, base); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (z === 'bjerge') {  // tinder
          h = 90 + r * 140;
          ctx.beginPath(); ctx.moveTo(x - 70, base); ctx.lineTo(x + 20, base - h); ctx.lineTo(x + 110, base); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 20, base - h); ctx.lineTo(x + 2, base - h * 0.8); ctx.lineTo(x + 38, base - h * 0.8); ctx.closePath(); ctx.fillStyle = c2; ctx.fill();
        } else if (z === 'skyer') {   // skyer
          var y = base - 60 - r * v.h * 0.5;
          ctx.beginPath(); ctx.ellipse(x, y, 50, 16, 0, 0, Math.PI * 2); ctx.ellipse(x + 30, y - 10, 30, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {                      // rummet: stjerner (faste, ingen blink) og en planet
          for (var j = 0; j < 5; j++) { var sx = x + rnd(i * 7 + j) * step, sy = rnd(i * 13 + j) * (base - 20); ctx.fillStyle = c2; ctx.fillRect(sx, sy, 2, 2); }
          if (i % 7 === 0) { ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, base - v.h * 0.55, 26, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    },
    jord: function (ctx, d, v, s) {
      var y = v.sy(0);
      noFx(ctx);
      ctx.fillStyle = s['jord-' + d.zone]; ctx.fillRect(0, y, v.w, v.h - y);
      glow(ctx, s, s['jord-' + d.zone + '-kant']);
      ctx.strokeStyle = s['jord-' + d.zone + '-kant']; ctx.lineWidth = s['jord-kant-w'];
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(v.w, y); ctx.stroke();
      noFx(ctx);
      // Svagt gitter i jorden (synthwave-gulv), der følger med banen
      var step = 10 * v.k; if (step < 12) step *= Math.ceil(12 / step);
      ctx.strokeStyle = s['jord-' + d.zone + '-kant']; ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = -(v.x0 * v.k % step); x < v.w; x += step) { ctx.moveTo(x, y); ctx.lineTo(x - (x - v.w / 2) * 0.4, v.h); }
      ctx.stroke(); ctx.globalAlpha = 1;
    },
    maaler: function (ctx, d, v, s) {
      var x = v.sx(d.x), y = v.sy(0);
      noFx(ctx); ctx.strokeStyle = s['maaler']; ctx.lineWidth = s['streg-w'];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke();
      if (d.tekst) tekst(ctx, d.tekst, x, y + 14 + s['tekst-str'], s, 'center', s['tekst-str'] * 0.85);
    },
    milepael: function (ctx, d, v, s) {
      var x = v.sx(d.x), y = v.sy(0), h = Math.max(70, 9 * v.k);
      glow(ctx, s, s['milepael']);
      ctx.strokeStyle = s['milepael']; ctx.lineWidth = s['streg-w'] * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
      ctx.fillStyle = s['milepael']; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 30, y - h + 10); ctx.lineTo(x, y - h + 20); ctx.closePath(); ctx.fill();
      tekst(ctx, d.navn, x + 6, y - h - 6, s, 'left');
    },
    startrampe: function (ctx, d, v, s) {
      var x0 = v.sx(-d.len), x1 = v.sx(0), y0 = v.sy(0), top = v.sy(d.h);
      var kick = 2.2 * Math.tan(d.vinkel * Math.PI / 180);   // lille kant, der viser vinklen
      shadow(ctx, s);
      ctx.beginPath(); ctx.moveTo(x0 - 30, top - 40); ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.6, top + 10, x1 - 2.2 * v.k, top);
      ctx.lineTo(x1, v.sy(d.h - kick * 0.2)); ctx.lineTo(x1, y0); ctx.lineTo(x0 - 30, y0); ctx.closePath();
      ctx.fillStyle = s['rampe']; ctx.fill();
      glow(ctx, s, s['rampe-kant']);
      ctx.strokeStyle = s['rampe-kant']; ctx.lineWidth = s['streg-w'] * 1.5; ctx.stroke();
      noFx(ctx);
      // Vinkelpil ved kanten
      var a = d.vinkel * Math.PI / 180, L = Math.max(40, 5 * v.k);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = s['forhaand-start']; ctx.lineWidth = s['streg-w'];
      ctx.beginPath(); ctx.moveTo(x1, top); ctx.lineTo(x1 + Math.cos(a) * L, top - Math.sin(a) * L); ctx.stroke(); ctx.setLineDash([]);
      kontur(ctx, s);
    },
    // ---------- Ting langs banen ----------
    trampolin: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 22), y = v.sy(0), h = px(v, o.h, 8);
      noFx(ctx); ctx.strokeStyle = s['trampolin']; ctx.lineWidth = s['streg-w'] * 1.5;
      ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 4, y - h); ctx.moveTo(x + w - 2, y); ctx.lineTo(x + w - 4, y - h); ctx.stroke();
      glow(ctx, s, s['trampolin-dug']);
      ctx.strokeStyle = s['trampolin-dug']; ctx.lineWidth = s['streg-w'] * 2;
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + w / 2, y - h + 5, x + w, y - h); ctx.stroke(); noFx(ctx);
    },
    rampe: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 24), y = v.sy(0), h = px(v, o.h, 10);
      shadow(ctx, s);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y - h); ctx.lineTo(x + w, y); ctx.closePath();
      ctx.fillStyle = s['rampe']; ctx.fill(); glow(ctx, s, s['rampe-ting']);
      ctx.strokeStyle = s['rampe-ting']; ctx.lineWidth = s['streg-w'] * 1.5; ctx.stroke(); noFx(ctx); kontur(ctx, s);
    },
    olie: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 30), y = v.sy(0);
      noFx(ctx); ctx.fillStyle = s['olie'];
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + 2, w / 2, Math.max(3, 0.5 * v.k), 0, 0, Math.PI * 2); ctx.fill(); kontur(ctx, s);
    },
    sten: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 12), y = v.sy(0), h = px(v, o.h, 10);
      shadow(ctx, s);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.15, y - h * 0.7); ctx.lineTo(x + w * 0.5, y - h); ctx.lineTo(x + w * 0.9, y - h * 0.6); ctx.lineTo(x + w, y); ctx.closePath();
      ctx.fillStyle = s['sten']; ctx.fill(); noFx(ctx);
      ctx.strokeStyle = s['sten-kant']; ctx.lineWidth = s['streg-w']; ctx.stroke(); kontur(ctx, s);
    },
    kaktus: function (ctx, o, v, s) {
      var x = v.sx(o.x + o.w / 2), y = v.sy(0), h = px(v, o.h, 20), w = Math.max(5, h * 0.22);
      glow(ctx, s, s['kaktus'], 0.5);
      ctx.strokeStyle = s['kaktus']; ctx.lineCap = 'round'; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h);
      ctx.moveTo(x, y - h * 0.5); ctx.lineTo(x - h * 0.28, y - h * 0.5); ctx.lineTo(x - h * 0.28, y - h * 0.78);
      ctx.moveTo(x, y - h * 0.62); ctx.lineTo(x + h * 0.26, y - h * 0.62); ctx.lineTo(x + h * 0.26, y - h * 0.86); ctx.stroke();
      ctx.lineCap = 'butt'; noFx(ctx);
    },
    kegle: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 9), y = v.sy(0), h = px(v, o.h, 12);
      noFx(ctx); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w, y); ctx.closePath();
      ctx.fillStyle = s['kegle']; ctx.fill(); kontur(ctx, s);
      ctx.fillStyle = s['kegle-stribe']; ctx.fillRect(x + w * 0.25, y - h * 0.55, w * 0.5, h * 0.14);
    },
    ballon: function (ctx, o, v, s) {
      var x = v.sx(o.x), y = v.sy(o.y), r = px(v, o.r, 9);
      noFx(ctx); ctx.strokeStyle = s['ballon-snor']; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y + r); ctx.quadraticCurveTo(x + r * 0.4, y + r * 2, x, y + r * 2.8); ctx.stroke();
      glow(ctx, s, s['ballon']);
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2); ctx.fillStyle = s['ballon']; ctx.fill(); noFx(ctx); kontur(ctx, s);
    },
    vind: function (ctx, o, v, s) {
      var x = v.sx(o.x), w = px(v, o.w, 40), y = v.sy(o.y + o.h), h = px(v, o.h, 26);
      glow(ctx, s, s['vind'], 0.5);
      ctx.strokeStyle = s['vind']; ctx.lineWidth = s['streg-w'] * 1.4; ctx.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        var yy = y + h * (0.25 + i * 0.25), a = x + (i % 2) * w * 0.15;
        ctx.beginPath(); ctx.moveTo(a, yy); ctx.lineTo(a + w * 0.7, yy);
        ctx.arc(a + w * 0.7, yy - h * 0.08, h * 0.08, Math.PI / 2, -Math.PI, true); ctx.stroke();
      }
      ctx.lineCap = 'butt'; noFx(ctx);
    },
    moent: function (ctx, o, v, s) {
      var x = v.sx(o.x), y = v.sy(o.y), r = px(v, o.r, 6);
      glow(ctx, s, s['moent'], 0.6);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = s['moent']; ctx.fill(); noFx(ctx);
      ctx.lineWidth = Math.max(1.5, r * 0.22); ctx.strokeStyle = s['moent-kant']; ctx.stroke();
    },
    bonus: function (ctx, o, v, s) {        // en dunk raketbrændstof: +1 boost
      var x = v.sx(o.x), y = v.sy(o.y), r = px(v, o.r, 10);
      glow(ctx, s, s['bonus']);
      rr(ctx, x - r * 0.7, y - r, r * 1.4, r * 2, r * 0.3); ctx.fillStyle = s['bonus']; ctx.fill(); noFx(ctx);
      ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.strokeStyle = s['bonus-kant']; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y); ctx.lineTo(x + r * 0.3, y); ctx.moveTo(x, y - r * 0.3); ctx.lineTo(x, y + r * 0.3); ctx.stroke();
    },
    // ---------- Bilen ----------
    bil: function (ctx, b, v, s) {
      var k = Math.max(v.k, 16);            // bilen er altid mindst ca. 50 px lang
      var x = v.sx(b.x), y = v.sy(b.y);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-b.vinkel); ctx.scale(k, k);
      var lw = s['streg-w'] / k;
      // Faldskærm (når den tager af en landing)
      if (b.skaerm) {
        noFx(ctx); ctx.strokeStyle = s['skaerm-snor']; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(-1.2, -1); ctx.lineTo(-2.6, -4.2); ctx.moveTo(0.4, -1); ctx.lineTo(1.2, -4.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3.2, -4); ctx.quadraticCurveTo(-0.7, -6.6, 1.8, -4); ctx.closePath(); ctx.fillStyle = s['skaerm']; ctx.fill();
      }
      // Raketflamme bagved
      if (b.flamme) {
        glow(ctx, s, s['flamme'], 1.2);
        ctx.beginPath(); ctx.moveTo(-1.7, -0.75); ctx.lineTo(-4.2, -0.6); ctx.lineTo(-1.7, -0.25); ctx.closePath(); ctx.fillStyle = s['flamme']; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-1.7, -0.65); ctx.lineTo(-3, -0.55); ctx.lineTo(-1.7, -0.4); ctx.closePath(); ctx.fillStyle = s['flamme-kerne']; ctx.fill();
        noFx(ctx);
      }
      if (b.raket) { rr(ctx, -2, -0.85, 1.1, 0.5, 0.2); ctx.fillStyle = s['raket']; ctx.fill(); kontur(ctx, s, lw); }
      // Karrosseri pr. biltype (y er negativ opad, fordi y-aksen på skærmen vender nedad)
      shadow(ctx, s);
      ctx.fillStyle = s['bil-krop']; ctx.strokeStyle = s['bil-kant']; ctx.lineWidth = lw;
      ctx.beginPath();
      if (b.type === 'saebekasse') {
        ctx.rect(-1.4, -0.95, 2.6, 0.6);
        ctx.fill(); noFx(ctx); ctx.stroke();
        ctx.fillStyle = s['bil-krop-2']; ctx.fillRect(-0.6, -1.45, 0.25, 0.5);          // ryglæn
        ctx.beginPath(); ctx.arc(-0.2, -1.55, 0.28, 0, Math.PI * 2); ctx.fillStyle = s['bil-rude']; ctx.fill();  // fører med hjelm
      } else if (b.type === 'folkevogn') {
        ctx.moveTo(-1.5, -0.35); ctx.lineTo(-1.5, -0.8); ctx.quadraticCurveTo(-1.2, -1.75, 0, -1.75); ctx.quadraticCurveTo(1.2, -1.75, 1.5, -0.8); ctx.lineTo(1.5, -0.35); ctx.closePath();
        ctx.fill(); noFx(ctx); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.2, -1.6); ctx.quadraticCurveTo(0.8, -1.55, 1.1, -0.95); ctx.lineTo(-0.2, -0.95); ctx.closePath(); ctx.fillStyle = s['bil-rude']; ctx.fill();
      } else if (b.type === 'sportsvogn') {
        ctx.moveTo(-1.6, -0.35); ctx.lineTo(-1.6, -0.95); ctx.lineTo(-0.4, -1.3); ctx.lineTo(0.5, -1.3); ctx.lineTo(1.7, -0.7); ctx.lineTo(1.7, -0.35); ctx.closePath();
        ctx.fill(); noFx(ctx); ctx.stroke();
        ctx.fillStyle = s['bil-krop-2']; ctx.fillRect(-1.75, -1.35, 0.5, 0.12);           // spoiler
        ctx.beginPath(); ctx.moveTo(-0.2, -1.22); ctx.lineTo(0.45, -1.22); ctx.lineTo(1.1, -0.9); ctx.lineTo(-0.2, -0.9); ctx.closePath(); ctx.fillStyle = s['bil-rude']; ctx.fill();
      } else {                                // raketbil
        ctx.moveTo(-1.7, -0.35); ctx.lineTo(-1.7, -1.0); ctx.lineTo(0.2, -1.2); ctx.quadraticCurveTo(1.6, -1.1, 2.2, -0.6); ctx.lineTo(1.9, -0.35); ctx.closePath();
        ctx.fill(); noFx(ctx); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-1.7, -1.0); ctx.lineTo(-2.1, -1.7); ctx.lineTo(-1.2, -1.05); ctx.closePath(); ctx.fillStyle = s['bil-krop-2']; ctx.fill();   // halefinne
        ctx.beginPath(); ctx.ellipse(0.5, -1.12, 0.55, 0.22, 0, Math.PI, 0); ctx.fillStyle = s['bil-rude']; ctx.fill();
      }
      // Vinger
      if (b.vinger) {
        var t = b.naese === 'op' ? -0.12 : b.naese === 'ned' ? 0.12 : 0;
        ctx.save(); ctx.translate(0, -0.8); ctx.rotate(t);
        glow(ctx, s, s['vinge'], 0.5);
        ctx.beginPath(); ctx.moveTo(-0.9, 0); ctx.lineTo(0.9, -0.05); ctx.lineTo(0.3, 0.18); ctx.lineTo(-1.1, 0.18); ctx.closePath();
        ctx.fillStyle = s['vinge']; ctx.fill(); noFx(ctx); kontur(ctx, s, lw);
        ctx.restore();
      }
      // Hjul
      [-0.95, 0.95].forEach(function (hx) {
        ctx.beginPath(); ctx.arc(hx, -0.35, 0.35, 0, Math.PI * 2); ctx.fillStyle = s['hjul']; ctx.fill();
        ctx.lineWidth = lw; ctx.strokeStyle = s['hjul-nav']; ctx.stroke();
      });
      ctx.restore();
    },
    spor: function (ctx, pts, v, s) {
      if (!pts || pts.length < 2) return;
      noFx(ctx); ctx.strokeStyle = s['spor']; ctx.lineWidth = s['spor-w']; ctx.lineJoin = 'round';
      ctx.setLineDash([s['spor-w'] * 2, s['spor-w'] * 3]);
      ctx.beginPath(); ctx.moveTo(v.sx(pts[0].x), v.sy(pts[0].y));
      for (var i = 1; i < pts.length; i++) ctx.lineTo(v.sx(pts[i].x), v.sy(pts[i].y));
      ctx.stroke(); ctx.setLineDash([]);
    },
    forhaand: function (ctx, d, v, s) {
      var pts = d.pts; if (!pts || pts.length < 2) return;
      var c = s['forhaand-' + d.slags], w = s['forhaand-w'];
      glow(ctx, s, c, 0.6);
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Med boost: sammenhængende linje. Uden boost og start: prikket.
      ctx.setLineDash(d.slags === 'med' ? [] : [w * 0.1, w * 2.6]);
      ctx.beginPath(); ctx.moveTo(v.sx(pts[0].x), v.sy(pts[0].y));
      for (var i = 1; i < pts.length; i++) ctx.lineTo(v.sx(pts[i].x), v.sy(pts[i].y));
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'; noFx(ctx);
    },
    landing: function (ctx, d, v, s) {
      var x = v.sx(d.x), y = v.sy(0), c = s['forhaand-' + d.slags];
      noFx(ctx); ctx.strokeStyle = c; ctx.lineWidth = s['forhaand-w'] * 0.8;
      ctx.beginPath(); ctx.moveTo(x - 12, y - 12); ctx.lineTo(x + 12, y + 12); ctx.moveTo(x + 12, y - 12); ctx.lineTo(x - 12, y + 12); ctx.stroke();
      if (d.tekst) {
        var yy = y - 18 - (d.raekke || 0) * (s['tekst-str'] + 8);
        tekst(ctx, d.tekst, x, yy, s, 'center');
      }
    }
  };

  // Ikoner til knapperne
  var ikoner = {
    'vinkel-op': '<path class="ico-line" d="M14 84 H86 M14 84 L74 30"/><path class="ico-fill" d="M70 14 L88 40 L60 40 Z"/>',
    'vinkel-ned': '<path class="ico-line" d="M14 84 H86 M14 84 L80 62"/><path class="ico-fill" d="M74 76 L92 58 L64 50 Z"/>',
    'kraft-ned': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-line" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-line" x="62" y="28" width="14" height="56" rx="3"/>',
    'kraft-op': '<rect class="ico-fill" x="14" y="62" width="14" height="22" rx="3"/><rect class="ico-fill" x="38" y="46" width="14" height="38" rx="3"/><rect class="ico-fill" x="62" y="28" width="14" height="56" rx="3"/>',
    'send': '<path class="ico-line" d="M10 80 Q40 80 60 50"/><path class="ico-fill" d="M52 30 L86 22 L74 56 Z"/>',
    'boost': '<path class="ico-fill" d="M40 30 H76 Q92 50 76 70 H40 Z"/><path class="ico-line" d="M34 40 L10 34 M34 50 L6 50 M34 60 L10 66"/>',
    'vent': '<circle class="ico-line" cx="50" cy="50" r="34"/><path class="ico-line" d="M50 28 V52 L66 62"/>',
    'naese-op': '<path class="ico-line" d="M14 70 L86 40"/><path class="ico-fill" d="M80 24 L94 44 L72 50 Z"/>',
    'naese-ned': '<path class="ico-line" d="M14 40 L86 70"/><path class="ico-fill" d="M72 82 L94 70 L78 54 Z"/>',
    'naese-lige': '<path class="ico-line" d="M10 55 H80"/><path class="ico-fill" d="M76 40 L94 55 L76 70 Z"/>',
    'fortsaet': '<path class="ico-fill" d="M28 18 L82 50 L28 82 Z"/>',
    'hurtig': '<path class="ico-fill" d="M12 22 L48 50 L12 78 Z M50 22 L86 50 L50 78 Z"/>',
    'rolig': '<path class="ico-fill" d="M30 22 L70 50 L30 78 Z"/>',
    'spring': '<path class="ico-fill" d="M14 22 L50 50 L14 78 Z M46 22 L76 50 L46 78 Z"/><rect class="ico-fill" x="78" y="22" width="10" height="56" rx="2"/>',
    'pause': '<rect class="ico-fill" x="26" y="20" width="16" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="16" height="60" rx="4"/>',
    'tilbage': '<path class="ico-line" d="M44 22 L16 50 L44 78 M18 50 H84"/>',
    'moent': '<circle class="ico-fill" cx="50" cy="50" r="36"/><path class="ico-line" d="M50 30 V70"/>',
    'vaerksted': '<path class="ico-line" d="M22 78 L58 42 M58 42 A18 18 0 1 1 74 26 L64 36 L72 44 L82 34 A18 18 0 0 1 58 42"/>',
    'bil': '<path class="ico-fill" d="M10 62 V46 L28 44 L40 30 H66 L80 44 L92 48 V62 Z"/><circle class="ico-line" cx="30" cy="68" r="10"/><circle class="ico-line" cx="74" cy="68" r="10"/>',
    // Opgraderinger
    'motor': '<rect class="ico-line" x="18" y="36" width="56" height="38" rx="6"/><path class="ico-line" d="M74 48 H88 V62 H74 M30 36 V24 H58 V36 M8 48 V64"/>',
    'daek': '<circle class="ico-line" cx="50" cy="50" r="36"/><circle class="ico-fill" cx="50" cy="50" r="12"/><path class="ico-line" d="M50 14 V30 M50 70 V86 M14 50 H30 M70 50 H86"/>',
    'karrosseri': '<path class="ico-line" d="M50 12 L84 24 V50 Q84 76 50 90 Q16 76 16 50 V24 Z"/>',
    'aero': '<path class="ico-line" d="M10 34 H62 Q80 34 80 22 M10 52 H86 M10 70 H58 Q76 70 76 82"/>',
    'vinger': '<path class="ico-fill" d="M50 44 L92 30 L84 50 L50 58 L16 50 L8 30 Z"/>',
    'raket': '<path class="ico-fill" d="M50 8 Q70 26 66 62 H34 Q30 26 50 8 Z"/><path class="ico-line" d="M34 62 L22 80 M66 62 L78 80 M44 72 L50 92 L56 72"/>',
    'braendstof': '<rect class="ico-fill" x="24" y="24" width="52" height="66" rx="8"/><path class="ico-line" d="M36 24 V12 H62"/>',
    'faldskaerm': '<path class="ico-fill" d="M10 46 Q50 0 90 46 Z"/><path class="ico-line" d="M12 46 L46 84 M50 46 V84 M88 46 L54 84"/><rect class="ico-fill" x="42" y="80" width="16" height="12" rx="2"/>'
  };

  // Lyde: neon bruger spillets egne standardlyde (js/lyd.js). Et andet tema kan give
  // enkelte lyde en anden klang: lyde: { landing: function (t, n, v) { v.tone(…); } }.
  var lyde = {};

  global.RampenTema = { navn: 'neon', zoner: ZONER, biler: BILER, farver: FARVER, tal: TAL, tegn: tegn, ikoner: ikoner, lyde: lyde };
})(typeof window !== 'undefined' ? window : globalThis);
