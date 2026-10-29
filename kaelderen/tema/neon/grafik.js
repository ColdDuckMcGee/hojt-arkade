/*
 * Kælderen – tema "neon" (cyberpunk-kælder): navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) sætter window.KaelderTema med de
 * samme navne. Her står INGEN farveværdier: alle farver og mål kommer fra
 * tema.css som CSS-variabler (--kaelder-<navn>), som tegnelaget (js/tegn.js)
 * læser og giver videre i objektet `s`.
 *
 *   teksturer.<navn>(ctx, n, s)   n × n px (n = 64). Farvelaget (det lys rammer).
 *   gloed.<navn>(ctx, n, s)       Valgfrit selvlysende lag (neonrør, lamper, øjne).
 *                                 Sort/gennemsigtigt = intet lys. Lyser i mørket.
 *   sprites.<navn> = { str, sted: 'gulv'|'loft'|'svaev', tegn(ctx, n, s), gloed(ctx, n, s) }
 *   tegn.<navn>(ctx, …, s)        2D-overlays i skærmens opløsning (liv, markering,
 *                                 våben, skade, scanlines, kort, minikort).
 *   ikoner.<navn>                 SVG i 100 × 100 med klasserne ico-line og ico-fill.
 */
(function (global) {
  'use strict';

  var FARVER = [
    'vaeg-a', 'vaeg-b', 'vaeg-fuge', 'vaeg-neon', 'rum-a', 'rum-b', 'rum-fuge', 'rum-lys',
    'doer-a', 'doer-b', 'doer-lys', 'laas', 'gulv-a', 'gulv-b', 'gulv-fuge', 'rumgulv-a', 'rumgulv-b', 'rumgulv-neon',
    'trappe-a', 'trappe-neon', 'loft-a', 'loft-b', 'rumloft-a', 'rumloft-neon',
    'kravler', 'kravler-oeje', 'skytte', 'skytte-visir', 'kolos', 'kolos-kerne', 'metal-lys', 'metal-moerk',
    'ammo', 'ammo-lys', 'liv', 'liv-kors', 'skat', 'skat-lys', 'noegle', 'noegle-lys', 'skilt', 'lampe',
    'taage', 'moerke', 'lampe-lys', 'lygte-lys',
    'livbar', 'livbar-lav', 'livbar-bund', 'livbar-kant', 'trussel', 'sover', 'markering', 'sigte', 'skade', 'skud',
    'scanline', 'tekst', 'tekst-kant',
    'kort-bund', 'kort-gulv', 'kort-rum', 'kort-vaeg', 'kort-doer', 'kort-laast', 'kort-trappe', 'kort-spiller',
    'kort-fjende', 'kort-ting', 'kort-noegle', 'kort-rute', 'kort-kant',
    'vaaben', 'vaaben-lys', 'vaaben-moerk', 'vaaben-neon'
  ];
  var TEKSTER = ['skrift'];
  var TAL = ['gloed', 'scanlines', 'vignet', 'taage-start', 'taage-slut', 'lys-omgivelse', 'lys-lampe', 'lys-lygte',
    'flimmer', 'kontur-w', 'skrift-vaegt', 'kort-streg', 'bloom'];

  // Farve-tekst → [r, g, b, a] (0–255). Bruges af tegnelaget til lys og tåge.
  var pc = null, pcx = null;
  function rgb(str) {
    if (!pc) { pc = document.createElement('canvas'); pc.width = pc.height = 1; pcx = pc.getContext('2d', { willReadFrequently: true }); }
    pcx.clearRect(0, 0, 1, 1); pcx.fillStyle = str || 'transparent'; pcx.fillRect(0, 0, 1, 1);
    var d = pcx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }
  // Fast "tilfældighed" pr. tekstur, så den ser ens ud hver gang
  function hash(x, y, k) { var h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function stoej(ctx, n, col, alpha, k, size) {
    ctx.fillStyle = col; size = size || 1;
    for (var y = 0; y < n; y += size) for (var x = 0; x < n; x += size) {
      var v = hash(x, y, k); if (v < 0.5) continue;
      ctx.globalAlpha = (v - 0.5) * 2 * alpha; ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lodret(ctx, n, a, b) { var g = ctx.createLinearGradient(0, 0, 0, n); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

  // ---------- Teksturer (farvelag) ----------
  var teksturer = {
    // Gangenes vægge: betonplader med fuger, nitter og et rør
    'vaeg': function (ctx, n, s) {
      ctx.fillStyle = lodret(ctx, n, s['vaeg-a'], s['vaeg-b']); ctx.fillRect(0, 0, n, n);
      stoej(ctx, n, s['vaeg-fuge'], 0.35, 1, 2);
      ctx.fillStyle = s['vaeg-fuge'];
      ctx.fillRect(0, 0, n, 2); ctx.fillRect(0, n / 2 - 1, n, 2); ctx.fillRect(n / 2 - 1, 0, 2, n / 2); ctx.fillRect(0, n / 2, 2, n / 2);
      ctx.fillStyle = s['metal-lys'];
      [[6, 6], [n - 8, 6], [6, n / 2 + 5], [n - 8, n / 2 + 5]].forEach(function (p) { ctx.globalAlpha = 0.5; ctx.fillRect(p[0], p[1], 2, 2); });
      ctx.globalAlpha = 1;
      // rør langs bunden
      ctx.fillStyle = s['metal-moerk']; ctx.fillRect(0, n - 14, n, 7);
      ctx.fillStyle = s['metal-lys']; ctx.globalAlpha = 0.45; ctx.fillRect(0, n - 13, n, 2); ctx.globalAlpha = 1;
      // neonliste (farven; lyset kommer fra gløden)
      ctx.fillStyle = s['vaeg-neon']; ctx.fillRect(0, 20, n, 2);
    },
    // Rummenes vægge: paneler med lyse kanter og små statuslys
    'vaeg-rum': function (ctx, n, s) {
      ctx.fillStyle = lodret(ctx, n, s['rum-a'], s['rum-b']); ctx.fillRect(0, 0, n, n);
      ctx.strokeStyle = s['rum-fuge']; ctx.lineWidth = 2;
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) { rr(ctx, 3 + i * 32, 3 + j * 32, 26, 26, 4); ctx.stroke(); }
      stoej(ctx, n, s['rum-fuge'], 0.25, 2, 2);
      ctx.fillStyle = s['rum-lys']; ctx.fillRect(10, 12, 3, 3); ctx.fillRect(42, 44, 3, 3);
    },
    // Dør: skydedør i stål med midtersøm og håndtag
    'doer': function (ctx, n, s) {
      ctx.fillStyle = lodret(ctx, n, s['doer-a'], s['doer-b']); ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = s['metal-moerk']; ctx.fillRect(0, 0, 5, n); ctx.fillRect(n - 5, 0, 5, n); ctx.fillRect(0, 0, n, 4);
      ctx.fillRect(n / 2 - 1, 4, 2, n - 4);
      ctx.strokeStyle = s['metal-lys']; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      for (var y = 10; y < n; y += 9) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(n / 2 - 4, y); ctx.moveTo(n / 2 + 4, y); ctx.lineTo(n - 8, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = s['doer-lys']; ctx.fillRect(n / 2 - 7, 28, 3, 10); ctx.fillRect(n / 2 + 4, 28, 3, 10);
    },
    'doer-laast': function (ctx, n, s) {
      teksturer['doer'](ctx, n, s);
      ctx.fillStyle = s['metal-moerk']; rr(ctx, n / 2 - 12, 22, 24, 22, 4); ctx.fill();
      ctx.strokeStyle = s['laas']; ctx.lineWidth = 2; rr(ctx, n / 2 - 12, 22, 24, 22, 4); ctx.stroke();
      ctx.fillStyle = s['laas']; ctx.fillRect(n / 2 - 5, 32, 10, 8);
      ctx.beginPath(); ctx.arc(n / 2, 31, 4, Math.PI, 0); ctx.lineWidth = 2; ctx.stroke();
    },
    // Gangenes gulv: beton med revner og en rist
    'gulv': function (ctx, n, s) {
      ctx.fillStyle = s['gulv-a']; ctx.fillRect(0, 0, n, n);
      stoej(ctx, n, s['gulv-b'], 0.6, 3, 2);
      ctx.strokeStyle = s['gulv-fuge']; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, 40); ctx.lineTo(18, 34); ctx.lineTo(26, 44); ctx.lineTo(40, 38); ctx.stroke();
      ctx.fillStyle = s['gulv-fuge']; ctx.fillRect(0, 0, n, 1); ctx.fillRect(0, 0, 1, n);
    },
    // Rummenes gulv: fliser med et svagt neongitter
    'gulv-rum': function (ctx, n, s) {
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? s['rumgulv-a'] : s['rumgulv-b']; ctx.fillRect(i * 32, j * 32, 32, 32);
      }
      stoej(ctx, n, s['gulv-fuge'], 0.3, 4, 2);
      ctx.fillStyle = s['rumgulv-neon']; ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, n, 1); ctx.fillRect(0, 0, 1, n); ctx.globalAlpha = 1;
    },
    // Trappens felt: en luge med pile ned
    'gulv-trappe': function (ctx, n, s) {
      ctx.fillStyle = s['trappe-a']; ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = s['metal-moerk']; ctx.fillRect(4, 4, n - 8, n - 8);
      ctx.fillStyle = s['trappe-a'];
      for (var y = 8; y < n - 8; y += 8) ctx.fillRect(8, y, n - 16, 3);
      ctx.fillStyle = s['trappe-neon'];
      ctx.fillRect(4, 4, n - 8, 2); ctx.fillRect(4, n - 6, n - 8, 2); ctx.fillRect(4, 4, 2, n - 8); ctx.fillRect(n - 6, 4, 2, n - 8);
    },
    'loft': function (ctx, n, s) {
      ctx.fillStyle = s['loft-a']; ctx.fillRect(0, 0, n, n);
      stoej(ctx, n, s['loft-b'], 0.5, 5, 2);
      ctx.fillStyle = s['metal-moerk']; ctx.fillRect(0, 22, n, 6); ctx.fillRect(0, 46, n, 3);
      ctx.fillStyle = s['metal-lys']; ctx.globalAlpha = 0.25; ctx.fillRect(0, 22, n, 1); ctx.globalAlpha = 1;
    },
    'loft-rum': function (ctx, n, s) {
      ctx.fillStyle = s['rumloft-a']; ctx.fillRect(0, 0, n, n);
      ctx.strokeStyle = s['loft-b']; ctx.lineWidth = 2; ctx.strokeRect(1, 1, n - 2, n - 2);
      ctx.fillStyle = s['rumloft-neon']; ctx.fillRect(14, 30, n - 28, 4);
    }
  };
  // ---------- Selvlysende lag ----------
  var gloed = {
    'vaeg': function (ctx, n, s) { ctx.fillStyle = s['vaeg-neon']; ctx.fillRect(0, 19, n, 4); ctx.globalAlpha = 0.35; ctx.fillRect(0, 17, n, 8); ctx.globalAlpha = 1; },
    'vaeg-rum': function (ctx, n, s) { ctx.fillStyle = s['rum-lys']; ctx.fillRect(9, 11, 5, 5); ctx.fillRect(41, 43, 5, 5); },
    'doer': function (ctx, n, s) { ctx.fillStyle = s['doer-lys']; ctx.fillRect(n / 2 - 7, 28, 3, 10); ctx.fillRect(n / 2 + 4, 28, 3, 10); },
    'doer-laast': function (ctx, n, s) {
      gloed['doer'](ctx, n, s);
      ctx.strokeStyle = s['laas']; ctx.lineWidth = 2; rr(ctx, n / 2 - 12, 22, 24, 22, 4); ctx.stroke();
      ctx.fillStyle = s['laas']; ctx.fillRect(n / 2 - 5, 32, 10, 8);
    },
    'gulv-rum': function (ctx, n, s) { ctx.fillStyle = s['rumgulv-neon']; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, n, 1); ctx.fillRect(0, 0, 1, n); ctx.globalAlpha = 1; },
    'gulv-trappe': function (ctx, n, s) {
      ctx.fillStyle = s['trappe-neon'];
      ctx.fillRect(4, 4, n - 8, 2); ctx.fillRect(4, n - 6, n - 8, 2); ctx.fillRect(4, 4, 2, n - 8); ctx.fillRect(n - 6, 4, 2, n - 8);
      ctx.beginPath(); ctx.moveTo(n / 2 - 12, 22); ctx.lineTo(n / 2, 34); ctx.lineTo(n / 2 + 12, 22); ctx.lineWidth = 4; ctx.strokeStyle = s['trappe-neon']; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(n / 2 - 12, 34); ctx.lineTo(n / 2, 46); ctx.lineTo(n / 2 + 12, 34); ctx.stroke();
    },
    'loft-rum': function (ctx, n, s) { ctx.fillStyle = s['rumloft-neon']; ctx.fillRect(14, 30, n - 28, 4); ctx.globalAlpha = 0.3; ctx.fillRect(10, 27, n - 20, 10); ctx.globalAlpha = 1; }
  };

  // ---------- Sprites (fjender og ting) ----------
  // str: højde i forhold til et felt. sted: gulv = står på gulvet, loft = hænger, svaev = svæver midt i rummet.
  function ben(ctx, x0, y0, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  var sprites = {
    // Kravler: lav, edderkoppeagtig drone med ét rødt øje
    kravler: { str: 0.55, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.strokeStyle = s['metal-moerk']; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ben(ctx, 22, 34, 8, 30, 4, 60); ben(ctx, 42, 34, 56, 30, 60, 60); ben(ctx, 24, 40, 14, 44, 12, 62); ben(ctx, 40, 40, 50, 44, 52, 62);
        ctx.strokeStyle = s['kravler']; ctx.lineWidth = 2;
        ben(ctx, 22, 34, 8, 30, 4, 60); ben(ctx, 42, 34, 56, 30, 60, 60); ben(ctx, 24, 40, 14, 44, 12, 62); ben(ctx, 40, 40, 50, 44, 52, 62);
        ctx.fillStyle = s['kravler']; ctx.beginPath(); ctx.ellipse(32, 36, 18, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s['metal-moerk']; ctx.beginPath(); ctx.ellipse(32, 38, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s['metal-lys']; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(28, 28, 8, 3, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = s['kravler-oeje']; ctx.beginPath(); ctx.arc(32, 38, 5, 0, Math.PI * 2); ctx.fill();
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['kravler-oeje']; ctx.beginPath(); ctx.arc(32, 38, 5, 0, Math.PI * 2); ctx.fill(); }
    },
    // Skytte: android med visir og våben
    skytte: { str: 0.92, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['metal-moerk'];
        ctx.fillRect(23, 40, 7, 24); ctx.fillRect(34, 40, 7, 24);           // ben
        ctx.fillStyle = s['skytte']; rr(ctx, 19, 18, 26, 25, 6); ctx.fill(); // krop
        ctx.fillStyle = s['metal-moerk']; ctx.fillRect(25, 24, 14, 3);
        ctx.fillStyle = s['skytte']; rr(ctx, 24, 3, 16, 15, 5); ctx.fill();  // hoved
        ctx.fillStyle = s['skytte-visir']; rr(ctx, 26, 8, 12, 4, 2); ctx.fill();
        ctx.fillStyle = s['skytte']; rr(ctx, 12, 20, 7, 18, 3); ctx.fill();    // arm
        ctx.fillStyle = s['metal-moerk']; rr(ctx, 42, 26, 14, 7, 2); ctx.fill(); // våben
        ctx.fillStyle = s['skytte-visir']; ctx.fillRect(54, 28, 3, 3);
        ctx.fillStyle = s['metal-lys']; ctx.globalAlpha = 0.35; ctx.fillRect(21, 19, 22, 2); ctx.globalAlpha = 1;
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['skytte-visir']; rr(ctx, 26, 8, 12, 4, 2); ctx.fill(); ctx.fillRect(54, 28, 3, 3); }
    },
    // Kolos: tung, bred maskine med glødende kerne
    kolos: { str: 1.0, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['metal-moerk']; ctx.fillRect(16, 44, 12, 20); ctx.fillRect(36, 44, 12, 20);
        ctx.fillStyle = s['kolos']; rr(ctx, 8, 14, 48, 34, 8); ctx.fill();
        ctx.fillStyle = s['kolos']; rr(ctx, 1, 14, 10, 28, 4); ctx.fill(); rr(ctx, 53, 14, 10, 28, 4); ctx.fill();
        ctx.fillStyle = s['metal-moerk']; rr(ctx, 22, 5, 20, 12, 4); ctx.fill();
        ctx.fillStyle = s['kolos-kerne']; ctx.fillRect(26, 9, 12, 3);
        ctx.fillStyle = s['metal-moerk']; ctx.beginPath(); ctx.arc(32, 30, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s['kolos-kerne']; ctx.beginPath(); ctx.arc(32, 30, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s['metal-lys']; ctx.globalAlpha = 0.3; ctx.fillRect(10, 16, 44, 2); ctx.globalAlpha = 1;
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['kolos-kerne']; ctx.beginPath(); ctx.arc(32, 30, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(26, 9, 12, 3); }
    },
    ammo: { str: 0.32, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['ammo']; rr(ctx, 6, 18, 52, 42, 6); ctx.fill();
        ctx.fillStyle = s['metal-moerk']; ctx.fillRect(6, 30, 52, 5);
        ctx.fillStyle = s['ammo-lys']; for (var i = 0; i < 4; i++) ctx.fillRect(12 + i * 11, 42, 7, 12);
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['ammo-lys']; for (var i = 0; i < 4; i++) ctx.fillRect(12 + i * 11, 42, 7, 12); }
    },
    liv: { str: 0.32, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['liv']; rr(ctx, 6, 16, 52, 44, 8); ctx.fill();
        ctx.fillStyle = s['liv-kors']; ctx.fillRect(26, 22, 12, 32); ctx.fillRect(16, 32, 32, 12);
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['liv-kors']; ctx.globalAlpha = 0.6; ctx.fillRect(26, 22, 12, 32); ctx.fillRect(16, 32, 32, 12); ctx.globalAlpha = 1; }
    },
    skat: { str: 0.34, sted: 'gulv',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['skat'];
        for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(32, 56 - i * 9, 22, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = s['skat-lys']; ctx.beginPath(); ctx.ellipse(32, 29, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s['metal-moerk']; ctx.font = 'bold 9px ' + s['skrift']; ctx.textAlign = 'center'; ctx.fillText('◆', 32, 32);
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['skat-lys']; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(32, 29, 16, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    },
    noegle: { str: 0.36, sted: 'svaev',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['noegle']; rr(ctx, 8, 16, 48, 32, 5); ctx.fill();
        ctx.fillStyle = s['metal-moerk']; ctx.fillRect(14, 24, 14, 10);
        ctx.fillStyle = s['noegle-lys']; ctx.fillRect(14, 40, 36, 3); ctx.fillRect(34, 24, 16, 3);
      },
      gloed: function (ctx, n, s) { ctx.strokeStyle = s['noegle-lys']; ctx.lineWidth = 3; rr(ctx, 8, 16, 48, 32, 5); ctx.stroke(); ctx.fillStyle = s['noegle-lys']; ctx.fillRect(14, 40, 36, 3); }
    },
    // Trappen: et holografisk skilt over lugen
    trappe: { str: 0.5, sted: 'svaev',
      tegn: function (ctx, n, s) {
        ctx.strokeStyle = s['skilt']; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(32, 50); ctx.moveTo(14, 32); ctx.lineTo(32, 52); ctx.lineTo(50, 32); ctx.stroke();
      },
      gloed: function (ctx, n, s) { sprites.trappe.tegn(ctx, n, s); }
    },
    // Lampe: et neonrør, der hænger fra loftet
    lampe: { str: 0.3, sted: 'loft',
      tegn: function (ctx, n, s) {
        ctx.fillStyle = s['metal-moerk']; ctx.fillRect(30, 0, 4, 30); ctx.fillRect(8, 30, 48, 8);
        ctx.fillStyle = s['lampe']; ctx.fillRect(10, 38, 44, 7);
      },
      gloed: function (ctx, n, s) { ctx.fillStyle = s['lampe']; ctx.fillRect(10, 38, 44, 7); ctx.globalAlpha = 0.4; ctx.fillRect(6, 34, 52, 16); ctx.globalAlpha = 1; }
    }
  };

  // ---------- 2D-overlays (i skærmens opløsning) ----------
  function tekst(ctx, t, x, y, str, s, farve, align) {
    ctx.font = s['skrift-vaegt'] + ' ' + Math.round(str) + 'px ' + s['skrift'];
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, str * 0.22); ctx.strokeStyle = s['tekst-kant'];
    ctx.strokeText(t, x, y); ctx.fillStyle = farve || s['tekst']; ctx.fillText(t, x, y);
  }
  var tegn = {
    // Fjendens liv over figuren: en bjælke med felter og tallet, og "sover" eller "Kan ramme dig" under
    livbar: function (ctx, d, s) {
      var w = d.w, h = Math.max(8, d.h), x = d.x - w / 2, y = d.y;
      ctx.fillStyle = s['livbar-bund']; rr(ctx, x, y, w, h, h / 2); ctx.fill();
      var f = Math.max(0, d.hp / d.max);
      ctx.fillStyle = f <= 0.34 ? s['livbar-lav'] : s['livbar']; rr(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill();
      ctx.strokeStyle = s['livbar-kant']; ctx.lineWidth = Math.max(1, s['kontur-w']); rr(ctx, x, y, w, h, h / 2); ctx.stroke();
      if (d.max <= 10) { ctx.strokeStyle = s['livbar-bund']; ctx.lineWidth = 1; for (var i = 1; i < d.max; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / d.max, y + 1); ctx.lineTo(x + w * i / d.max, y + h - 1); ctx.stroke(); } }
      var ts = Math.max(12, Math.min(26, d.tekst));
      tekst(ctx, d.navn + ' ' + d.hp + '/' + d.max, d.x, y - ts * 0.75, ts, s);
      if (d.trussel) tekst(ctx, 'Kan ramme dig', d.x, y + h + ts * 0.8, ts * 0.9, s, s['trussel']);
      else if (d.sover) tekst(ctx, 'sover', d.x, y + h + ts * 0.8, ts * 0.85, s, s['sover']);
    },
    // Rolig rød ramme om en fjende, der kan ramme dig i næste tur (intet blink). Teksten står ved livbjælken.
    trussel: function (ctx, r, s) {
      ctx.strokeStyle = s['trussel']; ctx.lineWidth = Math.max(3, r.w * 0.03);
      var k = Math.min(r.w, r.h) * 0.22, x = r.x, y = r.y, w = r.w, h = r.h;
      ctx.beginPath();
      ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
      ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
      ctx.stroke();
    },
    // Det, man peger eller kigger på (kig-og-gå)
    markering: function (ctx, r, s) {
      ctx.strokeStyle = s['markering']; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke(); ctx.setLineDash([]);
      if (r.tekst) tekst(ctx, r.tekst, r.x + r.w / 2, r.y - 16, r.str || 18, s, s['markering']);
    },
    feltMarkering: function (ctx, d, s) {
      ctx.strokeStyle = s['markering']; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2); ctx.stroke();
      if (d.tekst) tekst(ctx, d.tekst, d.x, d.y - d.ry - 16, d.str || 18, s, s['markering']);
    },
    // Lille sigtekorn midt i billedet
    sigtekorn: function (ctx, d, s) {
      var r = d.r; ctx.strokeStyle = d.aktiv ? s['trussel'] : s['sigte']; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(d.x - r, d.y); ctx.lineTo(d.x - r * 0.35, d.y); ctx.moveTo(d.x + r * 0.35, d.y); ctx.lineTo(d.x + r, d.y);
      ctx.moveTo(d.x, d.y - r); ctx.lineTo(d.x, d.y - r * 0.35); ctx.moveTo(d.x, d.y + r * 0.35); ctx.lineTo(d.x, d.y + r); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    // Spillerens våben nederst i billedet. d.rekyl 0–1 (kosmetisk), d.skud 0–1 (mundingslys, roligt)
    vaaben: function (ctx, d, s) {
      var w = d.w, x = d.x, y = d.y + d.rekyl * w * 0.06;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = s['vaaben-moerk']; rr(ctx, -w * 0.18, -w * 0.5, w * 0.36, w * 0.62, w * 0.05); ctx.fill();
      ctx.fillStyle = s['vaaben']; rr(ctx, -w * 0.13, -w * 0.62, w * 0.26, w * 0.4, w * 0.04); ctx.fill();
      ctx.fillStyle = s['vaaben-lys']; ctx.globalAlpha = 0.4; ctx.fillRect(-w * 0.1, -w * 0.6, w * 0.04, w * 0.34); ctx.globalAlpha = 1;
      ctx.fillStyle = s['vaaben-neon']; ctx.fillRect(-w * 0.13, -w * 0.36, w * 0.26, w * 0.03);
      if (d.skud > 0) {
        ctx.globalAlpha = 0.55 * d.skud; ctx.fillStyle = s['skud'];
        ctx.beginPath(); ctx.ellipse(0, -w * 0.68, w * 0.16, w * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
    // Rolig farvetone i kanten, når man er ramt (styrke 0–1, intet blink)
    skade: function (ctx, d, s) {
      var g = ctx.createRadialGradient(d.w / 2, d.h / 2, Math.min(d.w, d.h) * 0.3, d.w / 2, d.h / 2, Math.max(d.w, d.h) * 0.75);
      g.addColorStop(0, 'transparent'); g.addColorStop(1, s['skade']);
      ctx.globalAlpha = Math.min(1, d.styrke); ctx.fillStyle = g; ctx.fillRect(0, 0, d.w, d.h); ctx.globalAlpha = 1;
    },
    // Neon-efterbehandling: let glød (bloom) og scanlines. Kun når glød er slået til.
    efter: function (ctx, d, s) {
      if (s['bloom'] > 0 && d.kilde) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = s['bloom'];
        ctx.imageSmoothingEnabled = true; ctx.drawImage(d.kilde, 0, 0, d.w, d.h); ctx.restore();
      }
      if (s['scanlines'] > 0) {
        ctx.fillStyle = s['scanline']; ctx.globalAlpha = s['scanlines'];
        var step = Math.max(3, Math.round(d.h / 240));
        for (var y = 0; y < d.h; y += step) ctx.fillRect(0, y, d.w, 1);
        ctx.globalAlpha = 1;
      }
    },
    // Tal, der svæver over en fjende, når den rammes ("−2" eller "Forbi")
    tal: function (ctx, d, s) { ctx.globalAlpha = d.alpha; tekst(ctx, d.tekst, d.x, d.y, d.str, s, d.ond ? s['trussel'] : s['tekst']); ctx.globalAlpha = 1; },
    // ---------- Kortet ----------
    // d: { x, y, cs } (øverste venstre hjørne og feltstørrelse), felt: type-navn
    kortBund: function (ctx, d, s) { ctx.fillStyle = s['kort-bund']; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.strokeStyle = s['kort-kant']; ctx.lineWidth = 2; ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2); },
    kortFelt: function (ctx, d, s) {
      var c = { gulv: 'kort-gulv', rum: 'kort-rum', vaeg: 'kort-vaeg', doer: 'kort-doer', aaben: 'kort-doer', laast: 'kort-laast', trappe: 'kort-trappe' }[d.felt];
      if (!c) return;
      ctx.fillStyle = s[c];
      if (d.felt === 'aaben') { ctx.globalAlpha = 0.5; ctx.fillRect(d.x, d.y, d.cs, d.cs); ctx.globalAlpha = 1; return; }
      if (d.felt === 'trappe') { ctx.fillRect(d.x, d.y, d.cs, d.cs); ctx.fillStyle = s['kort-bund']; ctx.fillRect(d.x + d.cs * 0.25, d.y + d.cs * 0.25, d.cs * 0.5, d.cs * 0.5); return; }
      ctx.fillRect(d.x, d.y, d.cs + 0.5, d.cs + 0.5);
    },
    kortSpiller: function (ctx, d, s) {
      var c = d.cs; ctx.save(); ctx.translate(d.x + c / 2, d.y + c / 2); ctx.rotate(d.vinkel);
      ctx.fillStyle = s['kort-spiller']; ctx.strokeStyle = s['kort-bund']; ctx.lineWidth = Math.max(1, c * 0.08);
      ctx.beginPath(); ctx.moveTo(c * 0.48, 0); ctx.lineTo(-c * 0.36, c * 0.36); ctx.lineTo(-c * 0.18, 0); ctx.lineTo(-c * 0.36, -c * 0.36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    kortFjende: function (ctx, d, s) {
      var c = d.cs; ctx.fillStyle = s['kort-fjende'];
      ctx.beginPath(); ctx.arc(d.x + c / 2, d.y + c / 2, c * (d.type === 'kolos' ? 0.42 : d.type === 'kravler' ? 0.3 : 0.36), 0, Math.PI * 2); ctx.fill();
      if (d.trussel) { ctx.strokeStyle = s['trussel']; ctx.lineWidth = Math.max(1.5, c * 0.12); ctx.stroke(); }
    },
    kortTing: function (ctx, d, s) {
      var c = d.cs; ctx.fillStyle = d.type === 'noegle' ? s['kort-noegle'] : s['kort-ting'];
      if (d.type === 'noegle') { ctx.fillRect(d.x + c * 0.15, d.y + c * 0.3, c * 0.7, c * 0.4); return; }
      ctx.beginPath(); ctx.arc(d.x + c / 2, d.y + c / 2, c * 0.2, 0, Math.PI * 2); ctx.fill();
    },
    kortRute: function (ctx, d, s) {
      ctx.strokeStyle = s['kort-rute']; ctx.lineWidth = Math.max(2, d.cs * s['kort-streg']); ctx.setLineDash([d.cs * 0.3, d.cs * 0.25]);
      ctx.beginPath(); d.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.setLineDash([]);
    },
    kortValg: function (ctx, d, s) { ctx.strokeStyle = s['markering']; ctx.lineWidth = Math.max(2, d.cs * 0.14); ctx.strokeRect(d.x + 1, d.y + 1, d.cs - 2, d.cs - 2); },
    kortTekst: function (ctx, d, s) { tekst(ctx, d.tekst, d.x, d.y, d.str, s, s['tekst'], d.align); }
  };

  // ---------- Ikoner ----------
  var ikoner = {
    'frem': '<path class="ico-fill" d="M50 10 L86 50 H64 V90 H36 V50 H14 Z"/>',
    'tilbage': '<path class="ico-fill" d="M50 90 L86 50 H64 V10 H36 V50 H14 Z"/>',
    'drej-v': '<path class="ico-line" d="M74 80 V48 A22 22 0 0 0 52 26 H26"/><path class="ico-fill" d="M8 26 L32 6 V46 Z"/>',
    'drej-h': '<path class="ico-line" d="M26 80 V48 A22 22 0 0 1 48 26 H74"/><path class="ico-fill" d="M92 26 L68 6 V46 Z"/>',
    'side-v': '<path class="ico-fill" d="M8 50 L44 18 V36 H70 V64 H44 V82 Z"/><path class="ico-line" d="M86 22 V78"/>',
    'side-h': '<path class="ico-fill" d="M92 50 L56 18 V36 H30 V64 H56 V82 Z"/><path class="ico-line" d="M14 22 V78"/>',
    'skyd': '<circle class="ico-line" cx="50" cy="50" r="30"/><path class="ico-line" d="M50 6 V30 M50 70 V94 M6 50 H30 M70 50 H94"/><circle class="ico-fill" cx="50" cy="50" r="7"/>',
    'slaa': '<path class="ico-fill" d="M22 58 L40 30 L58 40 L78 20 L86 30 L66 52 L74 74 L48 84 Z"/>',
    'aabn': '<rect class="ico-line" x="18" y="10" width="64" height="80" rx="4"/><path class="ico-fill" d="M50 14 H78 V86 H50 Z" opacity=".35"/><path class="ico-line" d="M38 50 H62 M54 42 L62 50 L54 58"/>',
    'laast': '<rect class="ico-fill" x="22" y="44" width="56" height="44" rx="6"/><path class="ico-line" d="M34 44 V32 A16 16 0 0 1 66 32 V44"/>',
    'laas-op': '<rect class="ico-fill" x="22" y="44" width="56" height="44" rx="6"/><path class="ico-line" d="M34 44 V32 A16 16 0 0 1 64 26"/>',
    'saml': '<path class="ico-line" d="M50 10 V58 M30 40 L50 60 L70 40"/><path class="ico-fill" d="M16 70 H84 V90 H16 Z"/>',
    'trappe': '<path class="ico-line" d="M10 22 H32 V42 H52 V62 H72 V82 H92"/><path class="ico-fill" d="M20 60 L40 80 H20 Z"/>',
    'vent': '<circle class="ico-line" cx="50" cy="50" r="36"/><path class="ico-line" d="M50 26 V50 L66 60"/>',
    'kort': '<path class="ico-line" d="M10 22 L36 12 L64 24 L90 14 V78 L64 88 L36 76 L10 86 Z M36 12 V76 M64 24 V88"/>',
    'syn': '<path class="ico-line" d="M8 50 C24 24 76 24 92 50 C76 76 24 76 8 50 Z"/><circle class="ico-fill" cx="50" cy="50" r="12"/>',
    'pause': '<rect class="ico-fill" x="24" y="18" width="18" height="64" rx="4"/><rect class="ico-fill" x="58" y="18" width="18" height="64" rx="4"/>',
    'hal': '<path class="ico-line" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    'liv': '<path class="ico-fill" d="M50 86 C20 64 8 48 8 32 C8 18 19 9 31 9 C40 9 46 14 50 21 C54 14 60 9 69 9 C81 9 92 18 92 32 C92 48 80 64 50 86 Z"/>',
    'ammo': '<rect class="ico-fill" x="20" y="30" width="16" height="56" rx="3"/><rect class="ico-fill" x="42" y="30" width="16" height="56" rx="3"/><rect class="ico-fill" x="64" y="30" width="16" height="56" rx="3"/><path class="ico-fill" d="M20 30 L28 12 L36 30 Z M42 30 L50 12 L58 30 Z M64 30 L72 12 L80 30 Z"/>',
    'skat': '<ellipse class="ico-fill" cx="50" cy="74" rx="34" ry="12"/><ellipse class="ico-fill" cx="50" cy="56" rx="34" ry="12"/><ellipse class="ico-line" cx="50" cy="36" rx="34" ry="12"/>',
    'etage': '<path class="ico-line" d="M10 22 H32 V42 H52 V62 H72 V82 H92"/>',
    'noegle': '<rect class="ico-line" x="12" y="26" width="76" height="48" rx="6"/><rect class="ico-fill" x="22" y="36" width="20" height="14"/><path class="ico-line" d="M22 62 H78"/>',
    'rustning': '<path class="ico-fill" d="M50 8 L86 20 V48 C86 70 70 84 50 92 C30 84 14 70 14 48 V20 Z"/>'
  };

  global.KaelderTema = {
    navn: 'neon', farver: FARVER, tekster: TEKSTER, tal: TAL,
    teksturer: teksturer, gloed: gloed, sprites: sprites, tegn: tegn, ikoner: ikoner,
    rgb: rgb, lyde: {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
