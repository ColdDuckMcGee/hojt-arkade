/*
 * Kasser – temaet "neon": al grafik til lageret og knapperne, samlet ét sted.
 *
 * Et tema registrerer sig med KasserTema.registrer(navn, { tokens, tegn, ikoner }):
 *   tokens  navn → CSS-variabel. Værdierne læses med getComputedStyle (se tema.css), så her står
 *           ingen farver, glød, stregtykkelser eller hjørneradier. Tal (fx stregtykkelse som
 *           brøkdel af et felt) gøres til tal; resten er tekst (farver).
 *   tegn    tegnefunktioner med faste navne (se README): gulv, mur, murkant, maal, kasse,
 *           spiller, forhaandsvisning. De får canvas-konteksten c, feltets placering i pixel,
 *           feltstørrelsen S og T (tokens + T.glod = 0…1 fra --glow og T.font).
 *   ikoner  SVG-indhold til knapperne (viewBox 0 0 100 100), hentet via navn.
 * Gløden er kun pynt: med --glow: 0 (Glød fra eller høj kontrast) kan alt aflæses på form og farve.
 */
(function (global) {
  'use strict';
  var temaer = {};
  global.KasserTema = global.KasserTema || {
    registrer: function (navn, def) { temaer[navn] = def; },
    hent: function (navn) { return temaer[navn] || temaer.neon || null; },
    navne: function () { return Object.keys(temaer); },
    // De navne, et tema skal levere (bruges af testen)
    KRAEVET: {
      tegn: ['gulv', 'mur', 'murkant', 'maal', 'kasse', 'spiller', 'forhaandsvisning'],
      ikoner: ['hal', 'menu', 'fortryd', 'genstart', 'pil-op', 'pil-venstre', 'pil-hoejre', 'pil-ned']
    }
  };

  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  function lw(S, T) { return Math.max(T.stregMin, S * T.streg); }
  function glod(c, T, farve, S) {
    if (T.glod > 0) { c.shadowColor = farve; c.shadowBlur = S * T.glodBlur * T.glod; }
  }
  function ingenGlod(c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }

  var tegn = {
    // Et gulvfelt med en svag indre ramme
    gulv: function (c, x, y, S, T) {
      c.fillStyle = T.gulv; c.fillRect(x, y, S, S);
      c.strokeStyle = T.gulvStreg; c.lineWidth = Math.max(1, S * T.gulvStregB);
      c.strokeRect(x + S * 0.04, y + S * 0.04, S * 0.92, S * 0.92);
    },
    // Et murfelt: mørkt glas med svage diagonale striber (felterne flyder sammen til én masse)
    mur: function (c, x, y, S, T) {
      c.fillStyle = T.murFyld; c.fillRect(x, y, S, S);
      c.save(); c.beginPath(); c.rect(x, y, S, S); c.clip();
      c.strokeStyle = T.murGlans; c.lineWidth = Math.max(1, S * T.murGlansB);
      c.beginPath();
      for (var t = -1; t <= 1; t += 0.5) { c.moveTo(x + t * S, y + S); c.lineTo(x + (t + 1) * S, y); }
      c.stroke(); c.restore();
    },
    // Murens kant ind mod gulvet: segs = [[x1, y1, x2, y2], ...] i pixel
    murkant: function (c, segs, S, T) {
      c.beginPath();
      segs.forEach(function (s) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); });
      glod(c, T, T.mur, S);
      c.strokeStyle = T.mur; c.lineWidth = lw(S, T) * 1.3; c.lineCap = 'round'; c.stroke();
      ingenGlod(c); c.lineCap = 'butt';
    },
    // Et mål: en ruderamme midt i feltet (cx, cy er feltets midte)
    maal: function (c, cx, cy, S, T) {
      var r = S * 0.3;
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath();
      c.fillStyle = T.maalFyld; c.fill();
      glod(c, T, T.maal, S);
      c.strokeStyle = T.maal; c.lineWidth = lw(S, T) * 1.2; c.stroke();
      ingenGlod(c);
    },
    // En kasse i feltet (x, y = øverste venstre hjørne). o = { paaMaal, fast }
    kasse: function (c, x, y, S, T, o) {
      var m = S * 0.12, s = S - 2 * m, l = lw(S, T);
      var kant = o.fast ? T.fast : o.paaMaal ? T.kasseOk : T.kasse;
      rr(c, x + m, y + m, s, s, S * T.radiusKasse);
      c.fillStyle = o.paaMaal ? T.kasseOkFyld : T.kasseFyld; c.fill();
      glod(c, T, kant, S);
      c.strokeStyle = kant; c.lineWidth = l * 1.4; c.stroke();
      ingenGlod(c);
      var k = S * 0.1;
      c.strokeStyle = kant; c.lineWidth = l * 0.8; c.globalAlpha = 0.75;
      c.strokeRect(x + m + k, y + m + k, s - 2 * k, s - 2 * k);
      c.beginPath();
      c.moveTo(x + m + k, y + m + k); c.lineTo(x + m + s - k, y + m + s - k);
      c.moveTo(x + m + s - k, y + m + k); c.lineTo(x + m + k, y + m + s - k);
      c.stroke(); c.globalAlpha = 1;
      if (o.paaMaal) {   // et flueben: kassen står på et mål
        c.strokeStyle = T.flueben; c.lineWidth = l * 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x + S * 0.34, y + S * 0.52); c.lineTo(x + S * 0.46, y + S * 0.64); c.lineTo(x + S * 0.68, y + S * 0.38); c.stroke();
        c.lineCap = 'butt';
      }
      if (o.fast) {      // et lille udråbstegn-skilt: kassen sidder fast
        var sx = x + S * 0.8, sy = y + S * 0.2, sr = S * 0.15;
        c.fillStyle = T.fast; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
        c.fillStyle = T.fastTekst; c.font = 'bold ' + Math.round(sr * 1.5) + 'px ' + T.font;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', sx, sy + sr * 0.08);
      }
    },
    // Lagerarbejderen: en rund robot med visir, der kigger i gåretningen (cx, cy = midten)
    spiller: function (c, cx, cy, S, T, dir) {
      var pr = S * 0.32, d = DIRS[dir] || DIRS.down;
      c.beginPath(); c.arc(cx, cy, pr, 0, Math.PI * 2);
      c.fillStyle = T.spillerFyld; c.fill();
      glod(c, T, T.spiller, S * 1.15);
      c.strokeStyle = T.spiller; c.lineWidth = lw(S, T) * 1.6; c.stroke();
      ingenGlod(c);
      c.save(); c.translate(cx + d.x * pr * 0.25, cy + d.y * pr * 0.25);
      c.rotate(ANG[dir] || 0);
      rr(c, -pr * 0.2, -pr * 0.55, pr * 0.62, pr * 1.1, pr * 0.25);
      c.fillStyle = T.spiller; c.fill();
      c.restore();
    },
    // Hvor et træk vil gå hen (blik eller mus på en pil). p = { x, y, ok, dir, boxTo: {x, y} | null } i pixel
    forhaandsvisning: function (c, p, S, T) {
      var farve = p.ok ? T.vis : T.fast;
      c.setLineDash([S * T.stiplet, S * T.stiplet * 0.85]);
      c.strokeStyle = farve; c.lineWidth = lw(S, T) * 1.3;
      rr(c, p.x + S * 0.08, p.y + S * 0.08, S * 0.84, S * 0.84, S * T.radiusVis); c.stroke();
      c.setLineDash([]);
      if (p.boxTo) {
        c.fillStyle = farve;
        c.save(); c.translate(p.boxTo.x + S / 2, p.boxTo.y + S / 2); c.rotate(ANG[p.dir]);
        c.globalAlpha = 0.7;
        c.beginPath(); c.moveTo(S * 0.22, 0); c.lineTo(-S * 0.14, -S * 0.2); c.lineTo(-S * 0.14, S * 0.2); c.closePath(); c.fill();
        c.restore();
      }
    }
  };

  var ikoner = {
    hal: '<path class="ikon-streg" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    menu: '<rect x="18" y="24" width="64" height="10" rx="4"/><rect x="18" y="45" width="64" height="10" rx="4"/><rect x="18" y="66" width="64" height="10" rx="4"/>',
    fortryd: '<path d="M40 20 L14 44 L40 68 V54 C60 54 74 60 82 80 C82 54 66 36 40 34 Z"/>',
    genstart: '<path d="M50 16 A34 34 0 1 1 18 62 L30 58 A22 22 0 1 0 50 28 V42 L28 22 L50 4 Z"/>',
    'pil-op': '<path d="M50 12 L84 50 H63 V88 H37 V50 H16 Z"/>',
    'pil-venstre': '<path d="M12 50 L50 16 V37 H88 V63 H50 V84 Z"/>',
    'pil-hoejre': '<path d="M88 50 L50 16 V37 H12 V63 H50 V84 Z"/>',
    'pil-ned': '<path d="M50 88 L84 50 H63 V12 H37 V50 H16 Z"/>'
  };

  var tokens = {
    gulv: '--ks-floor', gulvStreg: '--ks-floor-line', gulvStregB: '--ks-floor-line-w',
    mur: '--ks-wall', murFyld: '--ks-wall-fill', murGlans: '--ks-wall-shine', murGlansB: '--ks-wall-shine-w',
    maal: '--ks-goal', maalFyld: '--ks-goal-fill',
    kasse: '--ks-box', kasseFyld: '--ks-box-fill', kasseOk: '--ks-box-done', kasseOkFyld: '--ks-box-done-fill', flueben: '--ks-check',
    spiller: '--ks-player', spillerFyld: '--ks-player-fill',
    vis: '--ks-preview', fast: '--ks-stuck', fastTekst: '--ks-stuck-text',
    streg: '--ks-line', stregMin: '--ks-line-min', glodBlur: '--ks-glow-blur',
    radiusKasse: '--ks-radius-box', radiusVis: '--ks-radius-preview', stiplet: '--ks-dash'
  };

  global.KasserTema.registrer('neon', { tokens: tokens, tegn: tegn, ikoner: ikoner });
})(window);
