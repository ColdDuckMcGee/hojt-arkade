/*
 * Kaperen – tegnelaget. Læser kun spillets tilstand og tegner kortet og
 * mødet til søs som SVG. Kender ingen farver, streger eller glød: udseendet
 * kommer fra klasser og CSS-variabler i det aktive tema, og skibe, flag, øer,
 * effekter og ikoner hentes ved navn fra temaets grafik.js (window.KaperenTema).
 *
 *   KaperenTegn.installer()                 lægger temaets grafik ind som <symbol>
 *   KaperenTegn.ikon('rom')                 HTML til et ikon (<svg><use …></svg>)
 *   KaperenTegn.felter(svg, data)           havet set oppefra: felter, land, havne,
 *                                           tåge, skibe og kurs (både havet omkring
 *                                           skibet og hele søkortet)
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
    sym('kap-felt-land', '0 0 100 100', T.felter.land, 'none');
    T.felter.top.forEach(function (o, i) { sym('kap-felt-top-' + i, '0 0 100 100', o); });
    sym('kap-felt-havn', '0 0 100 100', T.felter.havn);
    sym('kap-maal', '0 0 100 100', T.maal);
    sym('kap-kortskib', '0 0 40 40', T.kortskib);
    ['plask', 'traef', 'roeg'].forEach(function (n) { sym('kap-' + n, '0 0 40 40', T.effekter[n]); });
    sym('kap-storm', '0 0 100 60', T.effekter.storm);
    svg.innerHTML = '<defs>' + h +
      '<pattern id="kap-hav-moenster" width="60" height="30" patternUnits="userSpaceOnUse">' + T.havMoenster + '</pattern>' +
      '<pattern id="kap-taage-moenster" width="40" height="40" patternUnits="userSpaceOnUse">' + T.taage + '</pattern>' +
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
  function havFlade(w, h, y0) {
    y0 = y0 || 0;
    return '<rect class="kap-hav" x="0" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(h - y0) + '" fill="url(#kap-hav-grad)"/>' +
      '<rect class="kap-hav-tekstur" x="0" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(h - y0) + '" fill="url(#kap-hav-moenster)"/>';
  }

  // Havet set oppefra, felt for felt. Bruges både til havet omkring skibet og til søkortet.
  // data: { w, h, ts (feltets størrelse i px), cx, cy (feltet midt i billedet),
  //   felt(x, y) -> 'hav' | 'land' | 'havn' | 'ude', sett(x, y), iSyn(x, y) | null,
  //   havne: [{ id, x, y, navn, kendt }], valgt, skibe: [{ x, y, slags, retning }],
  //   spiller: { x, y, retning } | null, kurs: [[x, y], ...], syn: radius | null, kort: true/false }
  function felter(svg, d) {
    var w = d.w, h = d.h, ts = d.ts, s = '';
    svg.setAttribute('viewBox', '0 0 ' + f(w) + ' ' + f(h));
    function px(x) { return w / 2 + (x - d.cx) * ts; }
    function py(y) { return h / 2 + (y - d.cy) * ts; }
    var x0 = Math.floor(d.cx - w / (2 * ts)) - 1, x1 = Math.ceil(d.cx + w / (2 * ts)) + 1;
    var y0 = Math.floor(d.cy - h / (2 * ts)) - 1, y1 = Math.ceil(d.cy + h / (2 * ts)) + 1;
    var x, y, land = '', kyst = '', top = '', taage = '', dunkel = '', kant = '', gitter = '';
    var nTop = T.felter.top.length;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var ft = d.felt(x, y), L = px(x) - ts / 2, O = py(y) - ts / 2;
      if (ft === 'ude') { kant += '<rect x="' + f(L) + '" y="' + f(O) + '" width="' + f(ts + 0.5) + '" height="' + f(ts + 0.5) + '"/>'; continue; }
      if (!d.sett(x, y)) { taage += '<rect x="' + f(L) + '" y="' + f(O) + '" width="' + f(ts + 0.5) + '" height="' + f(ts + 0.5) + '"/>'; continue; }
      if (ft === 'land') {
        land += use('kap-felt-land', L - 0.25, O - 0.25, ts + 0.5, ts + 0.5);
        // Kystlinje mod vand, man har set
        [[0, -1, L, O, L + ts, O], [1, 0, L + ts, O, L + ts, O + ts], [0, 1, L, O + ts, L + ts, O + ts], [-1, 0, L, O, L, O + ts]].forEach(function (k) {
          var nf = d.felt(x + k[0], y + k[1]);
          if ((nf === 'hav' || nf === 'havn') && d.sett(x + k[0], y + k[1])) kyst += 'M' + f(k[2]) + ' ' + f(k[3]) + 'L' + f(k[4]) + ' ' + f(k[5]);
        });
        var hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (hsh % 5 < 2 && nTop) top += use('kap-felt-top-' + (hsh % nTop), L + ts * 0.15, O + ts * 0.15, ts * 0.7, ts * 0.7, 'kap-felt-top');
      } else if (!d.kort && !gitterSkjul(d)) {
        gitter += 'M' + f(L) + ' ' + f(O) + 'h' + f(ts) + 'v' + f(ts);
      }
      if (d.iSyn && !d.iSyn(x, y)) dunkel += '<rect x="' + f(L) + '" y="' + f(O) + '" width="' + f(ts + 0.5) + '" height="' + f(ts + 0.5) + '"/>';
    }
    s += havFlade(w, h);
    if (gitter) s += '<path class="kap-gitter" d="' + gitter + '"/>';
    s += '<g class="kap-land">' + land + '</g>';
    if (kyst) s += '<path class="kap-kyst" d="' + kyst + '"/>';
    s += top;
    // Havne
    (d.havne || []).forEach(function (hv) {
      if (!hv.kendt && !d.sett(hv.x, hv.y)) return;
      s += use('kap-felt-havn', px(hv.x) - ts / 2, py(hv.y) - ts / 2, ts, ts, 'kap-felt-havn');
    });
    // Kursen og målet
    if (d.kurs && d.kurs.length) {
      d.kurs.forEach(function (p, i) { if (i < d.kurs.length - 1) s += '<circle class="kap-kurs" cx="' + f(px(p[0])) + '" cy="' + f(py(p[1])) + '" r="' + f(Math.max(2, ts * 0.09)) + '"/>'; });
    }
    if (dunkel) s += '<g class="kap-dunkel">' + dunkel + '</g>';
    if (taage) s += '<g class="kap-taage">' + taage + '</g><g class="kap-taage-tekstur" fill="url(#kap-taage-moenster)">' + taage + '</g>';
    if (kant) s += '<g class="kap-verdens-kant">' + kant + '</g>';
    (d.havne || []).forEach(function (hv) {
      if (hv.id === d.valgt) s += use('kap-maal', px(hv.x) - ts * 0.75, py(hv.y) - ts * 0.75, ts * 1.5, ts * 1.5, 'kap-maal-g');
    });
    if (d.syn && d.spiller) s += '<circle class="kap-synsvidde" cx="' + f(px(d.spiller.x)) + '" cy="' + f(py(d.spiller.y)) + '" r="' + f((d.syn + 0.5) * ts) + '"/>';
    // Navne på kendte havne
    var fs = Math.max(11, Math.min(22, ts * (d.kort ? 0.5 : 0.3)));
    (d.havne || []).forEach(function (hv) {
      if (!hv.kendt) return;
      var ty = py(hv.y) - ts * 0.55;
      if (ty - fs < 2) ty = py(hv.y) + ts * 0.55 + fs;
      s += '<text class="kap-havn-navn' + (hv.id === d.valgt ? ' kap-havn-navn-valgt' : '') + '" x="' + f(px(hv.x)) + '" y="' + f(ty) + '" font-size="' + f(fs) + '" text-anchor="middle">' + hv.navn + '</text>';
    });
    // Skibe
    (d.skibe || []).forEach(function (sk) { s += topskib(px(sk.x), py(sk.y), ts, sk.slags, sk.retning || 0, 'kap-topskib-' + sk.slags); });
    if (d.spiller) s += topskib(px(d.spiller.x), py(d.spiller.y), ts, 'spiller', d.spiller.retning || 0, 'kap-spiller-top');
    svg.innerHTML = s;
  }
  function gitterSkjul(d) { return d.ts < 26; }
  // Et skib set oppefra med sit flag (flaget vendes ikke, så tegnet kan læses)
  function topskib(x, y, ts, slags, vinkel, cls) {
    var sz = ts * 0.86, fw = ts * 0.42, fh = fw * 0.65;
    return '<g class="kap-topskib ' + cls + '">' +
      '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(vinkel) + ')">' + use('kap-kortskib', -sz / 2, -sz / 2, sz, sz) + '</g>' +
      use('kap-flag-' + slags, x + ts * 0.08, y - ts * 0.5, fw, fh, 'kap-flag kap-flag-' + slags) + '</g>';
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
    s += havFlade(w, h, hy);
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

  global.KaperenTegn = { installer: installer, ikon: ikon, felter: felter, moede: moede, skibBillede: skibBillede };
})(typeof window !== 'undefined' ? window : globalThis);
