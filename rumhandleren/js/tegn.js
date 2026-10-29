/*
 * Rumhandleren – tegnelaget.
 *
 * Lægger temaets navngivne grafik (window.RumhandlerenTema) ind som <symbol> og tegner
 * stjernekortet som SVG. Her står ingen farver, glød, skygger eller streger: alt får
 * klasser (rh-...), som css/rumhandleren.css og temaets tema.css farver.
 * Kortet er 100 × 64 enheder (RumhandlerenLogik.KORT); planeterne får HTML-knapper
 * ovenpå (app.js), så dwell, mus, touch og tastatur virker.
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var L = global.RumhandlerenLogik;
  var KANT = 6;            // luft om kortet (kortets enheder)
  var PR = 4.4;            // planetens halve størrelse

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function installer() {
    var T = global.RumhandlerenTema;
    if (!T || document.getElementById('rh-grafik')) return;
    var html = '';
    function sym(id, indhold) { html += '<symbol id="' + id + '" viewBox="0 0 100 100">' + indhold + '</symbol>'; }
    Object.keys(T.ikoner).forEach(function (n) { sym('rh-ikon-' + n, T.ikoner[n]); });
    Object.keys(T.varer).forEach(function (n) { sym('rh-vare-' + n, T.varer[n]); });
    Object.keys(T.skibe).forEach(function (n) { sym('rh-skib-' + n, T.skibe[n]); });
    Object.keys(T.planeter).forEach(function (n) { sym('rh-planet-' + n, T.planeter[n]); });
    Object.keys(T.markoerer).forEach(function (n) { sym('rh-markoer-' + n, T.markoerer[n]); });
    var m = T.rumMoenster;
    html += '<pattern id="rh-rum-moenster" patternUnits="userSpaceOnUse" width="' + m.w + '" height="' + m.h +
      '" patternTransform="scale(0.5)">' + m.indhold + '</pattern>';
    html += '<radialGradient id="rh-rum-forloeb" cx="50%" cy="40%" r="75%"><stop offset="0" class="rh-rum-stop-2"/><stop offset="1" class="rh-rum-stop-1"/></radialGradient>';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'rh-grafik');
    svg.setAttribute('class', 'rh-grafik');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs>' + html + '</defs>';
    document.body.insertBefore(svg, document.body.firstChild);
  }

  function use(id, x, y, s, cls) {
    return '<use href="#' + id + '" x="' + (x - s / 2).toFixed(2) + '" y="' + (y - s / 2).toFixed(2) + '" width="' + s + '" height="' + s + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }

  // Hvor er et skib på kortet lige nu? (på en planet eller undervejs på et hop)
  function skibPunkt(s) {
    if (!s.rejse) { var p = L.PLANET[s.pos] || L.PLANET.kepler; return { x: p.x, y: p.y, vinkel: 0, ved: s.pos }; }
    var r = s.rejse, hop = r.hop || [], gaaet = Math.max(0, (r.ialt || r.dage) - r.dage) + 0.5;
    for (var i = 0; i < hop.length; i++) {
      var h = hop[i];
      if (gaaet <= h.dage || i === hop.length - 1) {
        var a = L.PLANET[h.fra], b = L.PLANET[h.til], f = Math.max(0.2, Math.min(0.8, gaaet / h.dage));
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vinkel: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
      }
      gaaet -= h.dage;
    }
    var q = L.PLANET[r.til]; return { x: q.x, y: q.y, vinkel: 0, ved: r.til };
  }

  /*
   * Tegner kortet. d = { game, valgt, sti: [planet-id ...], rute: {a, b} | null }
   */
  function kort(svg, d) {
    var g = d.game, st = g.state, W = L.KORT.bredde, H = L.KORT.hoejde;
    svg.setAttribute('viewBox', (-KANT) + ' ' + (-KANT) + ' ' + (W + 2 * KANT) + ' ' + (H + 2 * KANT));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var o = '';
    // Rummet
    o += '<rect class="rh-rum" x="' + (-KANT) + '" y="' + (-KANT) + '" width="' + (W + 2 * KANT) + '" height="' + (H + 2 * KANT) + '" rx="3"/>';
    o += '<rect class="rh-rum-tekstur" x="' + (-KANT) + '" y="' + (-KANT) + '" width="' + (W + 2 * KANT) + '" height="' + (H + 2 * KANT) + '" rx="3"/>';
    // Ruterne (farve + stiplet streg efter risiko) med antal dage på midten
    var ruter = '', dage = '';
    L.RUTER.forEach(function (r) {
      var a = L.PLANET[r[0]], b = L.PLANET[r[1]];
      ruter += '<line class="rh-rute rh-rute-r' + r[3] + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      dage += '<text class="rh-rute-dage" x="' + mx.toFixed(1) + '" y="' + (my + 0.9).toFixed(1) + '">' + r[2] + '</text>';
    });
    o += '<g class="rh-ruter">' + ruter + '</g>';
    // Ruteskibenes faste ruter
    st.skibe.forEach(function (s) {
      if (!s.rute) return;
      var a = L.PLANET[s.rute.a], b = L.PLANET[s.rute.b];
      o += '<line class="rh-ruteskib-sti" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
    });
    // Den planlagte rejse / den nye rute
    if (d.sti && d.sti.length > 1) {
      o += '<polyline class="rh-sti" points="' + d.sti.map(function (p) { return L.PLANET[p].x + ',' + L.PLANET[p].y; }).join(' ') + '"/>';
    }
    o += '<g class="rh-dage">' + dage + '</g>';
    // Planeterne
    var adg = {}; L.PLANETER.forEach(function (p) { adg[p.id] = g.adgang(p.id); });
    L.PLANETER.forEach(function (p) {
      var cls = 'rh-planet-g rh-fr-' + p.fraktion;
      var laast = adg[p.id] === false;
      if (laast) cls += ' rh-laast';
      if (p.id === d.valgt) cls += ' rh-valgt';
      if (d.rute && (p.id === d.rute.a || p.id === d.rute.b)) cls += ' rh-rute-ende';
      o += '<g class="' + cls + '" data-planet="' + p.id + '">';
      o += use('rh-planet-' + p.fraktion, p.x, p.y, PR * 2, 'rh-planet');
      if (laast) o += use('rh-markoer-laas', p.x, p.y, 4, 'rh-laas-m');
      var harNyhed = st.events.some(function (e) { return e.planet === p.id; });
      if (harNyhed) o += use('rh-markoer-begivenhed', p.x - 4.2, p.y - 3.8, 3.4, 'rh-begivenhed-m');
      var b = st.bygninger[p.id];
      if (b && (b.mine || b.fabrik || b.lager)) o += use('rh-markoer-bygning', p.x + 4.2, p.y - 3.8, 3.4, 'rh-bygning-m');
      o += '<text class="rh-navn' + (p.id === d.valgt ? ' rh-navn-valgt' : '') + '" x="' + p.x + '" y="' + (p.y + PR + 3.2).toFixed(1) + '">' + esc(p.navn) + '</text>';
      o += '</g>';
      if (p.id === d.valgt) o += use('rh-markoer-valg', p.x, p.y, PR * 2 + 4.5, 'rh-valg-m');
    });
    // Skibene: ruteskibe først, flagskibet øverst
    var ved = {};
    st.skibe.forEach(function (s) {
      if (s.id === st.flagskib) return;
      var pt = skibPunkt(s), n = 0;
      if (pt.ved) { n = ved[pt.ved] = (ved[pt.ved] || 0) + 1; }
      var x = pt.x + (pt.ved ? -PR - 1.2 - (n - 1) * 1.6 : 0), y = pt.y + (pt.ved ? PR - 0.6 : 0);
      o += '<g transform="translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') rotate(' + pt.vinkel.toFixed(0) + ')">' + use('rh-markoer-ruteskib', 0, 0, 3.2, 'rh-ruteskib-m') + '</g>';
    });
    var fs = g.flagskib(), fp = skibPunkt(fs);
    var fx = fp.x + (fs.rejse ? 0 : PR + 1.6), fy = fp.y + (fs.rejse ? 0 : -PR + 0.6);
    o += '<g class="rh-flagskib-g" transform="translate(' + fx.toFixed(2) + ' ' + fy.toFixed(2) + ') rotate(' + fp.vinkel.toFixed(0) + ')">' + use('rh-markoer-skib', 0, 0, 4.6, 'rh-skib-m') + '</g>';
    svg.innerHTML = o;
  }

  // Kortenhed → pixels i forhold til svg-elementets kasse
  function punkt(svg, x, y) {
    var r = svg.getBoundingClientRect(), W = L.KORT.bredde + 2 * KANT, H = L.KORT.hoejde + 2 * KANT;
    var s = Math.min(r.width / W, r.height / H);
    var ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
    return { x: ox + (x + KANT) * s, y: oy + (y + KANT) * s, skala: s };
  }

  function ikon(navn, cls) {
    return '<svg class="' + (cls || 'ikon') + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#rh-ikon-' + navn + '"/></svg>';
  }
  function vare(id, cls) {
    return '<svg class="' + (cls || 'vare-ill') + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#rh-vare-' + id + '"/></svg>';
  }
  function skib(type, cls) {
    return '<svg class="' + (cls || 'skib-ill') + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#rh-skib-' + type + '"/></svg>';
  }

  // Temaets værdi (fx til tegninger, der ikke kan bruge CSS direkte)
  function tema(navn, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(navn).trim(); }

  global.RumhandlerenTegn = { installer: installer, kort: kort, punkt: punkt, ikon: ikon, vare: vare, skib: skib, tema: tema, esc: esc, KANT: KANT };
})(typeof window !== 'undefined' ? window : globalThis);
