/*
 * Kabalen – tegnelaget. Læser kun spillets tilstand (fra logik.js) og et sæt mål
 * (geo, beregnet af app.js), og placerer kort og pladser i DOM'en. Kender ingen
 * farver: udseendet kommer fra klasser og CSS-variabler i det aktive tema, og
 * kulører, bagside og ikoner hentes ved navn fra temaets grafik.js (window.KabaleTema).
 *
 * Kortene er knapper (så dwell, tastatur og mus virker ens). Hvert kort har en
 * forside (værdi og kulør øverst til venstre, stor kulør i midten) og en bagside.
 *
 * Klasser: .kort.opad (forsiden op) · .rod / .sort · .valgt (valgt kort og kortene ovenpå)
 * · .maal (lovligt mål) · .tip (hint) · .tynd (kun en smal stribe kan ses) · .lav (lavt kort,
 * ingen stor kulør) · .gemt (ligger under andre kort). Pladser: .plads[data-slot].
 *
 * Lange bunker komprimeres: først bliver kort, der ikke kan flyttes, til smalle striber,
 * så bliver de skjulte kort (bagsiden op) til én lav stak med et tal, og til sidst
 * samles de nederste åbne kort under ét med et "+N"-mærke. Det øverste kort ses altid helt,
 * og kort, der kan flyttes, får så vidt muligt en stribe på mindst ca. 84 px.
 */
(function (global) {
  'use strict';
  var T = global.KabaleTema, L = global.KabaleLogik;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function installerGrafik(doc) {
    doc = doc || document;
    if (doc.getElementById('ka-grafik')) return;
    var svg = doc.createElementNS(SVGNS, 'svg');
    svg.id = 'ka-grafik';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('class', 'ka-ikoner');
    var html = '';
    Object.keys(T.ikoner).forEach(function (n) { html += '<symbol id="ka-ikon-' + n + '" viewBox="0 0 100 100">' + T.ikoner[n] + '</symbol>'; });
    Object.keys(T.kulorer).forEach(function (n) { html += '<symbol id="ka-kulor-' + n + '" viewBox="0 0 100 100">' + T.kulorer[n] + '</symbol>'; });
    html += '<symbol id="ka-bagside" viewBox="0 0 100 100">' + T.bagside + '</symbol>';
    svg.innerHTML = '<defs>' + html + '</defs>';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }
  function use(id, cls) { return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  // Fordel højden i en bunke. Returnerer y for hvert kort (fra bunkens top), hvor meget
  // der kan ses af hvert kort, og hvor mange kort der er samlet under ét.
  function allocate(p, H, geo, movable) {
    var d = p.d, n = p.c.length, u = n - d, i;
    var res = { y: [], vis: [], downH: 0, collapsed: 0, collapseAt: -1 };
    if (!n) return res;
    var badge = geo.badge;
    var step = geo.down, downH = d ? Math.max(badge, d * step) : 0;
    var off = [];
    for (i = 0; i < u - 1; i++) off.push(geo.big);
    function total() { var s = downH; for (var j = 0; j < off.length; j++) s += off[j]; return s + geo.ch; }
    // 1) kort, der ikke kan flyttes, bliver til smalle striber (nederste først)
    for (i = 0; i < off.length && total() > H; i++) if (!movable[d + i]) off[i] = geo.thin;
    // 2) også kort, der kan flyttes
    for (i = 0; i < off.length && total() > H; i++) off[i] = geo.thin;
    // 3) de skjulte kort samles i én lav stak med et tal
    if (total() > H && d) { downH = badge; step = d > 1 ? Math.max(1, (badge - 6) / (d - 1)) : 0; }
    // 4) de nederste åbne kort samles under ét med "+N"
    var collapsed = 0;
    while (total() > H && off.length > 1) { off.shift(); collapsed++; }
    res.downH = downH;
    var y = 0;
    for (i = 0; i < d; i++) { res.y.push(Math.min(i * step, Math.max(0, downH - 6))); res.vis.push(0); }
    y = downH;
    for (i = 0; i < u; i++) {
      res.y.push(y);
      if (i < collapsed) { res.vis.push(0); continue; }
      var o = i === u - 1 ? geo.ch : off[i - collapsed];
      res.vis.push(o);
      y += o;
    }
    if (collapsed) { res.collapsed = collapsed; res.collapseAt = d + collapsed; }
    return res;
  }

  function create(boardEl) {
    var cards = [], slots = {}, badges = {}, built = false, lastPos = {};
    function build() {
      boardEl.innerHTML = '';
      cards = []; slots = {}; badges = {}; lastPos = {};
      function slot(name, label) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'plads'; b.dataset.slot = name;
        b.setAttribute('aria-label', label);
        boardEl.appendChild(b); slots[name] = b; return b;
      }
      var st = slot('bunke', 'Bunken');
      st.innerHTML = '<span class="bunke-bag"><span class="bagside">' + use('ka-bagside', 'bg-maerke') + '</span></span>' + use('ka-ikon-vend', 'vend-ico') + '<span class="bunke-tal"></span>';
      slot('vendt', 'Vendte kort (tom)');
      for (var s = 0; s < 4; s++) {
        var f = slot('g' + s, 'Grundbunke ' + L.KULORNAVN[s]);
        f.innerHTML = use('ka-kulor-' + L.KULOR[s], 'plads-kulor');
      }
      for (var c = 0; c < 7; c++) slot('t' + c, 'Bunke ' + (c + 1) + ' (tom)');
      for (var k = 0; k < 52; k++) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'kort ' + (L.red(k) ? 'rod' : 'sort');
        el.dataset.k = k;
        var kn = L.KULOR[L.suit(k)];
        el.innerHTML = '<span class="forside"><span class="hj"><span class="v">' + L.VAERDI[L.rank(k)] + '</span>' + use('ka-kulor-' + kn, 'ks') + '</span>' + use('ka-kulor-' + kn, 'midt') + '</span>' +
          '<span class="bagside">' + use('ka-bagside', 'bg-maerke') + '</span>';
        boardEl.appendChild(el); cards.push(el);
      }
      for (var b = 0; b < 7; b++) {
        var sk = document.createElement('span'); sk.className = 'skjult-tal'; sk.setAttribute('aria-hidden', 'true'); boardEl.appendChild(sk);
        var pl = document.createElement('span'); pl.className = 'plus-tal'; pl.setAttribute('aria-hidden', 'true'); boardEl.appendChild(pl);
        badges['s' + b] = sk; badges['p' + b] = pl;
      }
      built = true;
    }
    function place(el, x, y, w, h) {
      var t = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      if (el.style.transform !== t) el.style.transform = t;
      var ws = Math.round(w) + 'px', hs = Math.round(h) + 'px';
      if (el.style.width !== ws) el.style.width = ws;
      if (el.style.height !== hs) el.style.height = hs;
    }
    function target(el, on) {
      el.tabIndex = on ? 0 : -1;
      if (on) el.removeAttribute('data-no-dwell'); else el.setAttribute('data-no-dwell', '');
    }
    function rectSlot(el, r) { place(el, r.x, r.y, r.w, r.h); el.style.zIndex = '1'; }
    // En plads, der er dækket af kort, kan ikke ses eller rammes. Den gøres inert og skjult for
    // hjælpemidler (fx TD Browse' farveprikker), så kun kortet ovenpå tilbydes.
    function cover(el, covered) {
      if (el.inert !== covered) el.inert = covered;
      if (covered) { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); } else el.removeAttribute('aria-hidden');
    }

    // view: { sel: { cards: [k…] } | null, targets: [{k:'t',col}|{k:'f',s}], hint: { cards, dest } | null,
    //         movable: { kort: true }, live, fresh (ny tilstand: ingen glidende bevægelse) }
    function render(s, view, geo) {
      if (!built) build();
      boardEl.style.width = geo.W + 'px'; boardEl.style.height = geo.H + 'px';
      var st = boardEl.style;
      st.setProperty('--ka-cw', geo.cw + 'px'); st.setProperty('--ka-ch', geo.ch + 'px');
      st.setProperty('--ka-idx', geo.idx + 'px'); st.setProperty('--ka-idx-tynd', geo.idxThin + 'px');
      st.setProperty('--ka-badge', geo.badge + 'px');
      boardEl.dataset.mode = geo.mode;
      var sel = {}, tg = { t: {}, f: {} }, hc = {}, hd = view.hint && view.hint.dest;
      if (view.sel) view.sel.cards.forEach(function (k) { sel[k] = true; });
      (view.targets || []).forEach(function (t) { if (t.k === 't') tg.t[t.col] = true; else tg.f[t.s] = true; });
      if (view.hint) (view.hint.cards || []).forEach(function (k) { hc[k] = true; });
      var live = view.live, pos = {};
      function put(k, x, y, w, h, z, o) {
        var el = cards[k], cl = el.classList;
        o = o || {};
        place(el, x, y, w, h);
        el.style.zIndex = String(z);
        cl.toggle('opad', !!o.up);
        cl.toggle('gemt', !!o.hidden);
        cl.toggle('tynd', !!o.thin);
        cl.toggle('lav', h < Math.max(w * 0.9, geo.idx * 2.6));
        cl.toggle('valgt', !!sel[k]);
        cl.toggle('maal', !!o.target);
        cl.toggle('tip', !!hc[k] || !!o.hintDest);
        el.dataset.synlig = String(Math.round(o.vis || 0));
        target(el, live && !!o.dwell);
        var label = o.up ? L.navn(k) : 'Kort med bagsiden op';
        if (o.label) label = o.label;
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
        if (o.hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
        if (el.inert !== !!o.hidden) el.inert = !!o.hidden; // skjulte kort (bunken, under vendte kort)
        pos[k] = x + ',' + y;
      }
      var sl = geo.slots, i, k;
      // Bunken
      var stockN = s.talon.length - s.w, so = sl.stock;
      rectSlot(slots.bunke, so);
      slots.bunke.classList.toggle('har-kort', stockN > 0);
      slots.bunke.classList.toggle('kan-vende', stockN === 0 && s.talon.length > 0);
      slots.bunke.classList.toggle('tom', s.talon.length === 0);
      slots.bunke.classList.toggle('tip', !!(hd && hd.k === 'bunke'));
      slots.bunke.querySelector('.bunke-tal').textContent = stockN > 0 ? String(stockN) : '';
      slots.bunke.setAttribute('aria-label', stockN > 0 ? 'Bunken: ' + stockN + ' kort. Vælg for at trække ' + (s.draw === 3 ? '3 kort' : 'et kort') : s.talon.length ? 'Vend bunken om' : 'Bunken er tom');
      target(slots.bunke, live && s.talon.length > 0);
      for (i = s.w; i < s.talon.length; i++) put(s.talon[i], so.x, so.y, so.w, so.h, 2, { hidden: true });
      // Vendte kort
      var wo = sl.waste, wtop = s.w - 1, fanN = s.draw === 3 ? Math.min(3, s.w) : 1;
      rectSlot(slots.vendt, wo);
      target(slots.vendt, false);
      cover(slots.vendt, s.w > 0);
      slots.vendt.classList.toggle('maal', false);
      for (i = 0; i < s.w; i++) {
        k = s.talon[i];
        var fi = i - (s.w - fanN), vis = fi >= 0;
        var x = wo.x + (vis ? fi * wo.fan : 0);
        var isTop = i === wtop;
        put(k, x, wo.y, geo.cw, wo.h, 10 + i, { up: vis, hidden: !vis, dwell: isTop, vis: isTop ? Math.min(geo.cw, wo.h) : wo.fan, thin: false, label: isTop ? L.navn(k) + ' (vendt kort)' : L.navn(k) });
      }
      // Grundbunker
      for (var su = 0; su < 4; su++) {
        var fo = sl.f[su], el = slots['g' + su], n = s.f[su];
        rectSlot(el, fo);
        el.classList.toggle('maal', !!tg.f[su]);
        el.classList.toggle('tip', !!(hd && hd.k === 'f' && hd.s === su));
        target(el, live && (!!tg.f[su] || (!n && false)));
        cover(el, n > 0);
        for (var r = 0; r < 13; r++) {
          k = L.kort(su, r);
          if (r >= n) continue;
          var topF = r === n - 1;
          put(k, fo.x, fo.y, fo.w, fo.h, 20 + r, { up: true, hidden: !topF && r < n - 2, dwell: topF, vis: topF ? Math.min(fo.w, fo.h) : 0, target: topF && !!tg.f[su], hintDest: topF && hd && hd.k === 'f' && hd.s === su, label: topF ? L.navn(k) + ' (grundbunke)' : '' });
        }
      }
      // Bunkerne (tableau)
      for (var c = 0; c < 7; c++) {
        var to = sl.t[c], p = s.t[c], slotEl = slots['t' + c];
        rectSlot(slotEl, { x: to.x, y: to.y, w: to.w, h: Math.min(to.h, geo.ch) });
        var emptyT = !p.c.length;
        slotEl.classList.toggle('maal', emptyT && !!tg.t[c]);
        slotEl.classList.toggle('tip', emptyT && !!(hd && hd.k === 't' && hd.col === c));
        slotEl.setAttribute('aria-label', 'Bunke ' + (c + 1) + (emptyT ? ' (tom)' : ''));
        target(slotEl, live && emptyT && !!tg.t[c]);
        cover(slotEl, !emptyT);
        var mv = {};
        for (i = p.d; i < p.c.length; i++) if (view.movable && view.movable[p.c[i]]) mv[i] = true;
        var al = allocate(p, to.h, geo, mv);
        for (i = 0; i < p.c.length; i++) {
          k = p.c[i];
          var up = i >= p.d, last = i === p.c.length - 1, visH = al.vis[i];
          var hiddenUnder = up && !last && visH === 0;
          put(k, to.x, to.y + al.y[i], to.w, geo.ch, 30 + i, {
            up: up, thin: up && !last && visH > 0 && visH < geo.big, hidden: false,
            dwell: up && (last || visH >= geo.big), vis: visH,
            target: last && !!tg.t[c], hintDest: last && hd && hd.k === 't' && hd.col === c,
            label: up ? L.navn(k) + (hiddenUnder ? ' (samlet)' : '') : 'Kort med bagsiden op'
          });
        }
        var sk = badges['s' + c], pl = badges['p' + c];
        sk.hidden = !p.d;
        if (p.d) {
          sk.textContent = String(p.d);
          place(sk, to.x + 4, to.y + 3, Math.max(geo.badge, 0), geo.badge - 6);
          sk.style.zIndex = String(30 + p.c.length + 1);
        }
        pl.hidden = !al.collapsed; pl.dataset.col = String(c); pl.dataset.n = String(al.collapsed || 0);
        if (al.collapsed) {
          pl.textContent = '+' + al.collapsed;
          var yy = to.y + al.y[al.collapseAt];
          place(pl, to.x + to.w - geo.badge * 1.5 - 4, yy + 3, geo.badge * 1.5, geo.thin - 6);
          pl.style.zIndex = String(30 + p.c.length + 1);
        }
      }
      // Kort, der skal glide, ligger øverst under bevægelsen
      cards.forEach(function (el, k) {
        if (lastPos[k] && pos[k] && lastPos[k] !== pos[k] && !view.fresh) {
          el.classList.add('flytter');
          clearTimeout(el._t);
          el._t = setTimeout(function () { el.classList.remove('flytter'); }, 400);
        }
        if (view.fresh) el.classList.remove('flytter');
      });
      boardEl.classList.toggle('ingen-glid', !!view.fresh);
      lastPos = pos;
    }
    return { build: build, render: render, get ready() { return built; }, card: function (k) { return cards[k]; }, slot: function (n) { return slots[n]; } };
  }

  global.KabaleTegn = { create: create, installerGrafik: installerGrafik, allocate: allocate };
})(typeof window !== 'undefined' ? window : globalThis);
