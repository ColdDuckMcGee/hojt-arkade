/*
 * Kaperen – tegnelaget. Læser kun spillets tilstand og tegner kortet og
 * mødet til søs som SVG. Kender ingen farver, streger eller glød: udseendet
 * kommer fra klasser og CSS-variabler i det aktive tema, og skibe, flag, øer,
 * effekter og ikoner hentes ved navn fra temaets grafik.js (window.KaperenTema).
 *
 *   KaperenTegn.installer()                 lægger temaets grafik ind som <symbol>
 *   KaperenTegn.ikon('rom')                 HTML til et ikon (<svg><use …></svg>)
 *   KaperenTegn.kort(svg, data)             kortet: hav, øer, ruter og kompas
 *   KaperenTegn.moede(svg, data)            mødet: himmel, hav, skibe, flag og effekter
 */
(function (global) {
  'use strict';
  var T = global.KaperenTema;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function installer(doc) {
    doc = doc || document;
    if (doc.getElementById('kap-grafik')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'kap-grafik';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'kap-grafik');
    var h = '';
    function sym(id, vb, body, par) { h += '<symbol id="' + id + '" viewBox="' + vb + '" overflow="visible"' + (par ? ' preserveAspectRatio="' + par + '"' : '') + '>' + body + '</symbol>'; }
    Object.keys(T.ikoner).forEach(function (n) { sym('kap-ikon-' + n, '0 0 100 100', T.ikoner[n]); });
    Object.keys(T.skibe).forEach(function (n) { sym('kap-skib-' + n, '0 0 100 100', T.skibe[n]); });
    Object.keys(T.flag).forEach(function (n) { sym('kap-flag-' + n, '0 0 40 26', T.flag[n]); });
    T.oeer.forEach(function (o, i) { sym('kap-oe-' + i, '0 0 100 60', o, 'none'); });  // øerne må strækkes (stregerne skaleres ikke)
    sym('kap-kortskib', '0 0 40 40', T.kortskib);
    sym('kap-kompas', '0 0 100 100', T.kompas);
    ['plask', 'traef', 'roeg'].forEach(function (n) { sym('kap-' + n, '0 0 40 40', T.effekter[n]); });
    sym('kap-storm', '0 0 100 60', T.effekter.storm);
    svg.innerHTML = '<defs>' + h +
      '<pattern id="kap-hav-moenster" width="60" height="30" patternUnits="userSpaceOnUse">' + T.havMoenster + '</pattern>' +
      '<linearGradient id="kap-hav-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="kap-hav-stop-1"/><stop offset="1" class="kap-hav-stop-2"/></linearGradient>' +
      '<linearGradient id="kap-himmel-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="kap-himmel-stop-1"/><stop offset="1" class="kap-himmel-stop-2"/></linearGradient>' +
      '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function ikon(navn, cls) {
    return '<svg class="ikon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#kap-ikon-' + navn + '"/></svg>';
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function use(id, x, y, w, h, cls, extra) {
    return '<use href="#' + id + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (cls ? ' class="' + cls + '"' : '') + (extra || '') + '/>';
  }
  function hav(w, h, y0) {
    y0 = y0 || 0;
    return '<rect class="kap-hav" x="0" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(h - y0) + '" fill="url(#kap-hav-grad)"/>' +
      '<rect class="kap-hav-tekstur" x="0" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(h - y0) + '" fill="url(#kap-hav-moenster)"/>';
  }

  // Kortet. data: { w, h, havne: [{ id, cx, cy, bw, bh, oe }], her, valgt, pynt: [{ x, y, s, oe }] }
  function kort(svg, d) {
    var w = d.w, h = d.h, s = '';
    svg.setAttribute('viewBox', '0 0 ' + f(w) + ' ' + f(h));
    s += hav(w, h);
    // Små øer som pynt
    (d.pynt || []).forEach(function (p) { s += use('kap-oe-' + p.oe, p.x - p.s / 2, p.y - p.s * 0.3, p.s, p.s * 0.6, 'kap-oe kap-oe-pynt'); });
    var her = null, valgt = null, byId = {};
    d.havne.forEach(function (p) { byId[p.id] = p; if (p.id === d.her) her = p; if (p.id === d.valgt) valgt = p; });
    // Ruter fra havnen, man er i
    if (her) {
      d.havne.forEach(function (p) {
        if (p === her) return;
        s += '<line class="kap-rute' + (p === valgt ? ' kap-rute-valgt' : '') + '" x1="' + f(her.cx) + '" y1="' + f(her.cy) + '" x2="' + f(p.cx) + '" y2="' + f(p.cy) + '"/>';
      });
    }
    // En ø under hver havn
    d.havne.forEach(function (p) {
      // Øen stikker lidt ud under og over knappen (stregerne skaleres ikke med)
      var ow = p.bw * 1.18, oh = Math.min(p.bh * 1.5, ow * 0.6);
      s += '<use href="#kap-oe-' + p.oe + '" x="' + f(p.cx - ow / 2) + '" y="' + f(p.cy - oh / 2) + '" width="' + f(ow) + '" height="' + f(oh) + '" class="kap-oe"/>';
    });
    if (d.kompas) s += use('kap-kompas', d.kompas.x - d.kompas.r, d.kompas.y - d.kompas.r, d.kompas.r * 2, d.kompas.r * 2, 'kap-kompas');
    svg.innerHTML = s;
  }

  // Et skib med flag. retning: 1 = mod højre, -1 = mod venstre
  function skib(type, slags, x, y, size, retning, cls, haeld) {
    var fp = T.flagPunkt[type] || [50, 10];
    var fw = size * 0.26, fh = fw * 0.65;
    var g = '<g class="kap-skib-g ' + (cls || '') + '" transform="translate(' + f(x) + ' ' + f(y) + ')' + (haeld ? ' rotate(' + haeld + ')' : '') + ' scale(' + retning + ' 1)">';
    g += use('kap-skib-' + type, -size / 2, -size * 0.8, size, size, 'kap-skib');
    var fx = -size / 2 + fp[0] / 100 * size, fy = -size * 0.8 + fp[1] / 100 * size;
    g += '<line class="kap-mast" x1="' + f(fx) + '" y1="' + f(fy) + '" x2="' + f(fx) + '" y2="' + f(fy - fh * 0.9) + '"/>';
    g += use('kap-flag-' + slags, fx, fy - fh * 1.1, fw, fh, 'kap-flag kap-flag-' + slags);
    return g + '</g>';
  }
  var POS = [0.47, 0.6, 0.73, 0.86, 0.97];
  var SKALA = [1, 0.86, 0.72, 0.6, 0.5];
  // Effekter fra sidste runde, der rammer skibet ved (x, y) med størrelsen size
  function effekt(sk, x, y, size, n) {
    if (!sk || !sk.kanoner) return '';
    var s = '', e = size * 0.3;
    for (var i = 0; i < Math.min(3, sk.traef); i++) s += use('kap-traef', x - e / 2 + (i - 1) * e * 0.8, y - size * 0.45 - e / 2 + (i % 2) * e * 0.4, e, e, 'kap-effekt');
    var miss = Math.min(3, sk.kanoner - sk.traef);
    for (var j = 0; j < miss; j++) s += use('kap-plask', x + (j - 1) * size * 0.35 + (n % 2 ? 6 : -6), y - e * 0.9, e, e, 'kap-effekt');
    return s;
  }
  function roeg(x, y, size) { var e = size * 0.28; return use('kap-roeg', x - e / 2, y - size * 0.35 - e / 2, e, e, 'kap-effekt'); }

  // Mødet. data: { w, h, spiller: {type}, fjende: {type, slags, afstand} | null, storm, sidste, slut }
  function moede(svg, d) {
    var w = d.w, h = d.h, s = '', hy = h * 0.42;
    svg.setAttribute('viewBox', '0 0 ' + f(w) + ' ' + f(h));
    s += '<rect class="kap-himmel" x="0" y="0" width="' + f(w) + '" height="' + f(hy) + '" fill="url(#kap-himmel-grad)"/>';
    s += hav(w, h, hy);
    s += '<line class="kap-horisont" x1="0" y1="' + f(hy) + '" x2="' + f(w) + '" y2="' + f(hy) + '"/>';
    var size = Math.min(h * 0.62, w * 0.3), wy = h * 0.82;
    if (d.storm) {
      var sw = Math.min(w * 0.7, h * 1.2);
      s += use('kap-storm', w / 2 - sw / 2, h * 0.02, sw, sw * 0.6, 'kap-storm');
      s += skib(d.spiller.type, 'spiller', w * 0.5, wy, size, 1, 'kap-spiller', d.slut ? 0 : -8);
      svg.innerHTML = s; return;
    }
    var px = w * 0.2;
    var sid = d.sidste, fj = d.fjende;
    if (fj && fj.afstand < 4 && !(d.slut === 'sænket')) {
      var a = Math.max(0, Math.min(4, fj.afstand)), fsz = size * SKALA[a], fx = w * POS[a], fy = hy + (wy - hy) * (1 - a * 0.12);
      s += skib(fj.type, fj.slags, fx, fy, fsz, -1, 'kap-fjende' + (d.slut === 'kapret' ? ' kap-kapret' : ''));
      if (sid && sid.spiller && sid.spiller.type === 'skud') s += effekt(sid.spiller.skud, fx, fy, fsz, 1);
      if (sid && sid.fjende && sid.fjende.skud && sid.fjende.skud.kanoner) s += roeg(fx - fsz * 0.45, fy, fsz);
    } else if (fj && d.slut === 'sænket') {
      var sz2 = size * SKALA[Math.min(4, fj.afstand)], sx2 = w * POS[Math.min(4, fj.afstand)];
      s += use('kap-plask', sx2 - sz2 * 0.3, wy - sz2 * 0.5, sz2 * 0.6, sz2 * 0.6, 'kap-effekt');
    }
    s += skib(d.spiller.type, 'spiller', px, wy, size, 1, 'kap-spiller');
    if (sid && sid.spiller && sid.spiller.type === 'skud') s += roeg(px + size * 0.45, wy, size);
    if (sid && sid.fjende && sid.fjende.skud) s += effekt(sid.fjende.skud, px, wy, size, 2);
    svg.innerHTML = s;
  }

  // Et enkelt skib med spillerens flag på en bølge (startmenuen)
  function skibBillede(svg, type) {
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = '<path class="kap-hav-boelge" d="M0 88 Q12.5 80 25 88 T50 88 T75 88 T100 88"/>' + skib(type || 'brig', 'spiller', 50, 88, 84, 1, 'kap-spiller');
  }

  global.KaperenTegn = { installer: installer, ikon: ikon, kort: kort, moede: moede, skibBillede: skibBillede };
})(typeof window !== 'undefined' ? window : globalThis);
