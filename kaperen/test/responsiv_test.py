# Responsiv test af Kaperen: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl i konsollen.
#
# Desuden spillet i browseren: køb og sælg (mus og tastatur), værft (kikkert), værtshus
# (rygte), havet i tåge (kompas, felter og tastatur), søkortet (vælg havn, sæt kurs,
# autosejlads, ankomst), møder (skyd, ryk nærmere, bord, flygt, sejl videre, storm), pause, "Gå i land" med bekræftelse og rekord, game over, gem/fortsæt,
# glød fra, dwell (knappen under blikket vælges ikke af sig selv) og mindre bevægelse.
# Til sidst hallen med Kaperen aktiv.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 kaperen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     KAPEREN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('KAPEREN_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
if SHOT: os.makedirs(SHOT + 'ekstra', exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MIN_BTN = 80
errs=[]; fails=[]; summary={}
CHECK = """(sel) => {
  const se = document.scrollingElement, W = se.clientWidth, H = se.clientHeight;
  const vis = e => !e.closest('[hidden]') && !e.closest('.trin-skjult') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const out = {scroll: se.scrollHeight > se.clientHeight || se.scrollWidth > se.clientWidth, inner: [], clipped: [], overlap: [], textOut: []};
  document.querySelectorAll('.screen, .overlay, #game .view').forEach(s => {
     if (s.closest('[hidden]')) return;
     if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) out.inner.push((s.id||s.className) + ' ' + s.scrollWidth + 'x' + s.scrollHeight + '/' + s.clientWidth + 'x' + s.clientHeight); });
  const scr = document.querySelector(sel);
  const bekr = document.getElementById('bekraeft-overlay');
  const roots = [scr]; if (!bekr.hidden) roots.push(bekr);
  roots.forEach(r0 => r0.querySelectorAll('button, a, h1, h2, h3, p, li, .hud, .setting-label, .trin-label, .value-box, .scene-chip, #rygte span, #skib-kort span').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
     // Tekst, der er klippet af sin boks (overflow hidden)
     if ((e.tagName === 'P' || e.classList.contains('scene-chip') || e.classList.contains('hud')) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)) out.textOut.push((e.id || e.className) + ' ' + e.scrollWidth + 'x' + e.scrollHeight + '>' + e.clientWidth + 'x' + e.clientHeight);
  }));
  // Nabofelterne på havet er usynlige klikflader oven på kortet (de er lige så store som et felt)
  let bs = []; roots.forEach(r0 => bs.push(...[...r0.querySelectorAll('button, a.btn')].filter(e => vis(e) && !e.classList.contains('felt-btn'))));
  const name = e => e.id || e.dataset.vare || e.dataset.havn || e.dataset.fane || e.dataset.koeb && 'koeb' + e.dataset.koeb || e.dataset.saelg && 'saelg' + e.dataset.saelg || e.dataset.vaerft || e.dataset.tab || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // Kortet må ikke ligge under knappanelet
  [['#hav-boks', '#hav-panel'], ['#kort-boks', '.kort-panel'], ['#scene-boks', '#moede-knapper']].forEach(([x, y]) => { const ex = scr.querySelector(x), ey = scr.querySelector(y);
     if (!ex || !ey || !vis(ex) || !vis(ey)) return; const a = ex.getBoundingClientRect(), b = ey.getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.overlap.push(x + '/' + y); });
  // Hvis et overlay er åbent, tæller kun dets knapper (resten ligger bag det)
  const ov = !bekr.hidden ? bekr : [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const counted = ov ? bs.filter(e => ov.contains(e)) : bs;
  const sizes = counted.map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]; }).sort((a, b) => a[0] - b[0]);
  counted.forEach(e => { if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) out.textOut.push(name(e) + ' ' + e.scrollWidth + 'x' + e.scrollHeight + '>' + e.clientWidth + 'x' + e.clientHeight); });
  out.minBtn = sizes.length ? sizes[0][0] : null;
  out.minName = sizes.length ? sizes[0][1] : '';
  out.zoomed = [...document.querySelectorAll('*')].some(e => e.style && e.style.zoom && e.style.zoom !== '1' && !e.closest('[hidden]'));
  return out; }"""
def name_tag(w, h): return 'responsiv-%dx%d' % (w, h)
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_BTN
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn
    extra = ''
    if sel == '#game': extra += ' layout=%s btn=%s' % (pg.evaluate("document.getElementById('game').className"), pg.evaluate("document.getElementById('game').dataset.btn"))
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-28s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + ('' if shot == '%s.png' % name_tag(w, h) else 'ekstra/') + shot)
def pages(pg, scr, w, h, name, shotbase):
    n = 1
    while True:
        check(pg, '%s side %d' % (name, n), scr, w, h, shotbase and '%s-trin%d.png' % (shotbase, n))
        nxt = pg.locator(scr + ' .trin-nav:not([hidden]) .trin-next')
        if nxt.count() == 0 or nxt.is_disabled(): break
        nxt.click(); pg.wait_for_timeout(60); n += 1
        if n > 8: fails.append('for mange sider ' + name); break
    return n
def st(pg, expr): return pg.evaluate(expr)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
# Et spil, der står midt i et møde af en bestemt slags: sejl ud af havnen, læg et skib ved siden af, og sejl ind i det
def moede_state(pg, slags, ber=0):
    return pg.evaluate("""([slags, ber]) => { const L = Kaperen.logik, R = L.RETNINGER;
      for (let s = 1; s < 3000; s++) { const g = L.createGame({ seed: s }), st = g.state; st.beroemmelse = ber; st.proviant = 30;
        const nb = p => { for (let r = 0; r < 8; r++) { const x = p[0] + R[r][0], y = p[1] + R[r][1]; if (g.felt(x, y) === 'hav') return [x, y, r]; } return null; };
        let n = nb(st.pos); if (!n) continue;
        const r1 = g.flyt(R[n[2]][0], R[n[2]][1]); if (!r1.ok || r1.moede || st.havn) continue;
        st.skibe = [];
        if (slags === 'storm') { st.moede = { slags: 'storm', slut: null }; Kaperen.setState(g.save()); return s; }
        n = nb(st.pos); if (!n) continue;
        g._nytSkib(slags, n[0], n[1]);
        const r2 = g.flyt(R[n[2]][0], R[n[2]][1]);
        if (r2.moede && r2.moede.slags === slags) { Kaperen.setState(g.save()); return s; } } return -1; }""", [slags, ber])
def afslut_moede(pg):
    for _ in range(40):
        if st(pg, "!Kaperen.game.state.moede || !!Kaperen.game.state.moede.slut || !!Kaperen.game.state.over"): break
        pg.click('#btn-laa' if st(pg, "Kaperen.game.state.moede.slags") == 'storm' else '#btn-flygt'); pg.wait_for_timeout(30)
    if not st(pg, "!!Kaperen.game.state.over") and st(pg, "Kaperen.view") == 'moede':
        pg.click('#btn-videre'); pg.wait_for_timeout(80)
def ny(pg):
    pg.evaluate("Kaperen.nyRejse()"); pg.wait_for_timeout(120)

def gameplay(pg, w, h, tag, big):
    ny(pg)
    s0 = st(pg, "[Kaperen.view, Kaperen.game.state.guld, Kaperen.game.state.havn]")
    if s0[0] != 'havn' or s0[1] != 300: fails.append('%s ny rejse: %s' % (tag, s0))
    # Marked: vælg en vare og køb med musen
    pg.click('#varer .vare-btn[data-vare=tobak]'); pg.wait_for_timeout(40)
    g0 = st(pg, "Kaperen.game.state.guld"); p = st(pg, "Kaperen.game.pris('tobak').koeb")
    pg.click('[data-koeb="1"]'); pg.wait_for_timeout(40)
    if st(pg, "[Kaperen.game.state.last.tobak, Kaperen.game.state.guld]") != [1, g0 - p]: fails.append(tag + ' Køb 1 virkede ikke')
    pg.click('[data-koeb="5"]'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.game.state.last.tobak") != 6: fails.append(tag + ' Køb 5 virkede ikke')
    if 'købte' not in st(pg, "document.getElementById('besked').textContent"): fails.append(tag + ' ingen besked efter køb')
    # Billig/dyr vises tydeligt
    tags = st(pg, "[...document.querySelectorAll('#varer .vare-tag')].map(e => e.className.split(' ')[1])")
    if not ('billig' in tags or 'dyr' in tags): fails.append('%s ingen billig/dyr-markering: %s' % (tag, tags))
    check(pg, 'havn: marked', '#game', w, h, tag + '-marked.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'havn-handel.png')
    # Tastatur: 2 = sukker, K køber, Skift+S sælger 5
    pg.mouse.move(1, 1); pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.press('2'); pg.keyboard.press('k'); pg.wait_for_timeout(40)
    pg.keyboard.press('1'); pg.keyboard.press('4'); pg.keyboard.press('Shift+S'); pg.wait_for_timeout(40)
    r = st(pg, "[Kaperen.game.state.last.sukker, Kaperen.game.state.last.tobak]")
    if r != [1, 1]: fails.append('%s tastatur køb/salg gav %s' % (tag, r))
    pg.click('[data-saelg="alt"]'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.game.state.last.tobak") != 0: fails.append(tag + ' Sælg alt virkede ikke')
    # Værft
    pg.evaluate("Kaperen.game.state.guld = 5000; Kaperen.game.state.skrog -= 10; Kaperen.refresh()")
    pg.click('.fane-btn[data-fane=vaerft]'); pg.wait_for_timeout(60)
    check(pg, 'havn: værft', '#game', w, h, tag + '-vaerft.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'vaerft.png')
    pg.click('[data-vaerft=reparer]'); pg.click('[data-vaerft=kanon]'); pg.click('[data-vaerft=sejl]'); pg.click('[data-vaerft=lastrum]'); pg.wait_for_timeout(40)
    r = st(pg, "(() => { const g = Kaperen.game, s = g.state; return [s.skrog === g.maxSkrog(), s.kanoner, s.sejl, s.lastrum]; })()")
    if r != [True, 3, 1, 1]: fails.append('%s værftet gav %s' % (tag, r))
    pg.click('[data-vaerft=skib]'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.game.state.skib") != 'brig': fails.append(tag + ' køb brig virkede ikke')
    # Værtshus
    pg.click('.fane-btn[data-fane=vaerthus]'); pg.wait_for_timeout(60)
    check(pg, 'havn: værtshus', '#game', w, h, tag + '-vaerthus.png')
    pg.click('[data-hyr="5"]'); pg.click('[data-proviant=alt]'); pg.wait_for_timeout(40)
    r = st(pg, "[Kaperen.game.state.mandskab, Kaperen.game.state.proviant, Kaperen.logik.PROVIANT_MAX]")
    if r[0] != 13 or r[1] != r[2]: fails.append('%s værtshus gav %s' % (tag, r))
    # Kikkert på værftet
    pg.click('.fane-btn[data-fane=vaerft]'); pg.wait_for_timeout(40)
    pg.click('[data-vaerft=kikkert]'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.game.synsvidde()") != st(pg, "Kaperen.logik.SYN") + 1: fails.append(tag + ' kikkerten virkede ikke')
    # Rygter i værtshuset: to nye havne på kortet
    pg.click('.fane-btn[data-fane=vaerthus]'); pg.wait_for_timeout(40)
    pg.click('#btn-rygte'); pg.wait_for_timeout(40); pg.click('#btn-rygte'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.game.kendteHavne().length") != 3: fails.append(tag + ' rygterne gav ikke nye havne: %s' % st(pg, "Kaperen.game.kendteHavne()"))
    # Havet i tåge
    pg.click('#btn-til-soes'); pg.wait_for_timeout(120)
    if st(pg, "Kaperen.view") != 'hav': fails.append(tag + ' Til søs viste ikke havet')
    check(pg, 'hav (i havn)', '#game', w, h, tag + '-hav-havn.png')
    d0 = st(pg, "Kaperen.game.state.dag")
    ret = st(pg, "[...document.querySelectorAll('.ret-btn[data-ret]')].filter(b => !b.disabled).map(b => b.dataset.ret)")
    if not ret: fails.append(tag + ' ingen retning at sejle i')
    else:
        p0 = st(pg, "Kaperen.game.state.pos.join()")
        pg.click('.ret-btn[data-ret="%s"]' % ret[0]); pg.wait_for_timeout(80)
        # At sejle ind i et skib starter et møde uden at bruge en dag
        if st(pg, "Kaperen.view") == 'moede' and st(pg, "Kaperen.game.state.pos.join()") == p0: afslut_moede(pg)
        else:
            if st(pg, "Kaperen.view") == 'moede': afslut_moede(pg)
            # Én dag for feltet (en storm, hvor man søger læ, kan koste to dage mere)
            if not st(pg, "!!Kaperen.game.state.over") and (st(pg, "Kaperen.game.state.dag") < d0 + 1 or st(pg, "Kaperen.game.state.pos.join()") == p0):
                fails.append(tag + ' kompasset sejlede ikke ét felt (én dag)')
    # Nabofelt med musen og tastaturet
    if st(pg, "Kaperen.view") == 'hav':
        fb = st(pg, "[...document.querySelectorAll('.felt-btn')].filter(b => !b.disabled).map(b => b.dataset.ret)")
        d1 = st(pg, "Kaperen.game.state.dag")
        if fb:
            p1 = st(pg, "Kaperen.game.state.pos.join()")
            pg.click('.felt-btn[data-ret="%s"]' % fb[0]); pg.wait_for_timeout(80)
            moedt = st(pg, "Kaperen.view") == 'moede'
            if moedt: afslut_moede(pg)
            if st(pg, "Kaperen.game.state.dag") != d1 + 1 and not (moedt and st(pg, "Kaperen.game.state.pos.join()") == p1): fails.append(tag + ' klik på nabofelt sejlede ikke')
        pg.mouse.move(1, 1); pg.evaluate("document.activeElement && document.activeElement.blur()")
        pg.evaluate("Kaperen.game.state.havn || (Kaperen.game.state.skibe = [])")
        d2 = st(pg, "Kaperen.game.state.dag"); pg.keyboard.press(' ' if not st(pg, "Kaperen.game.state.havn") else 'ArrowUp'); pg.wait_for_timeout(60)
        if st(pg, "Kaperen.view") == 'moede': afslut_moede(pg)
        pg.evaluate("Kaperen.refresh()")
    pg.evaluate("(() => { const st = Kaperen.game.state; st.skibe = []; Kaperen.refresh(); })()")
    if st(pg, "Kaperen.view") == 'hav':
        check(pg, 'hav i tåge', '#game', w, h, tag + '-hav.png')
        if big and SHOT:
            # Et skib i sigte og et i tågen
            pg.evaluate("""(() => { const g = Kaperen.game, st = g.state; let n = 0;
              for (let y = 0; y < 15 && n < 2; y++) for (let x = 0; x < 24 && n < 2; x++) { const d = Math.max(Math.abs(x - st.pos[0]), Math.abs(y - st.pos[1]));
                if (g.felt(x, y) === 'hav' && ((n === 0 && d === 3 && g.iSyn(x, y)) || (n === 1 && d === 2 && g.iSyn(x, y)))) { g._nytSkib(n ? 'handel' : 'pirat', x, y); n++; } }
              Kaperen.refresh(); })()""")
            pg.wait_for_timeout(100); pg.screenshot(path=SHOT + 'hav-taage.png')
            pg.evaluate("Kaperen.game.state.skibe = []; Kaperen.refresh()")
    # Søkortet: kun det opdagede og de kendte havne
    pg.evaluate("Kaperen.aabnKort()"); pg.wait_for_timeout(100)
    if st(pg, "Kaperen.view") != 'kort': fails.append(tag + ' K/Kort åbnede ikke søkortet')
    v0 = st(pg, "Kaperen.valgtHavn")
    fv = st(pg, "[Kaperen.game.state.havn, Kaperen.game.state.sidste, Kaperen.game.forvalgtHavn()]")
    if v0 is not None and v0 in fv[:2]: fails.append('%s søkortet forvalgte havnen, man ligger i/har forladt: %s' % (tag, v0))
    if v0 != fv[2]: fails.append('%s søkortet forvalgte %s, ikke nærmeste anden havn %s' % (tag, v0, fv[2]))
    if v0 is None and not st(pg, "document.getElementById('kort-titel').textContent.startsWith('Ingen ny havn')"): fails.append(tag + ' ingen pæn besked uden anden havn')
    check(pg, 'søkort (delvist)', '#game', w, h, tag + '-kort-delvist.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'kort-delvist.png')
    pg.mouse.move(1, 1); pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    if st(pg, "Kaperen.valgtHavn") == v0: fails.append(tag + ' piletast skiftede ikke havn på kortet')
    # Hele havet kendt: sæt kurs og sejl selv derhen
    til = st(pg, "(() => { const g = Kaperen.game, st = g.state; st.set = st.set.replace(/0/g, '1'); const ids = g.kendteHavne().filter(i => i !== st.havn).sort((a, b) => g.kursInfo(b).dage - g.kursInfo(a).dage); Kaperen.vaelgHavn(ids[0]); return ids[0]; })()")
    st(pg, "Kaperen.game.state.proviant = 40"); pg.wait_for_timeout(60)
    check(pg, 'søkort: havn valgt', '#game', w, h, tag + '-kort.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'kort.png')
    for _ in range(25):
        if st(pg, "!!Kaperen.game.state.over") or st(pg, "Kaperen.game.state.havn") == til: break
        if st(pg, "Kaperen.view") == 'moede': afslut_moede(pg); continue
        if st(pg, "Kaperen.view") != 'kort': pg.evaluate("Kaperen.aabnKort()"); pg.evaluate("Kaperen.vaelgHavn('%s')" % til); pg.wait_for_timeout(40)
        pg.evaluate("Kaperen.game.state.skibe = []; Kaperen.game.state.proviant = 40")
        pg.click('#btn-kurs')
        pg.wait_for_function("!Kaperen.sejler", timeout=15000); pg.wait_for_timeout(60)
    if not st(pg, "!!Kaperen.game.state.over") and st(pg, "[Kaperen.view, Kaperen.game.state.havn]") != ['havn', til]: fails.append('%s kursen endte ikke i %s: %s' % (tag, til, st(pg, "[Kaperen.view, Kaperen.game.state.havn]")))
    # Møde med en sørøver: skyd, ryk nærmere og bord
    moede_state(pg, 'pirat'); pg.wait_for_timeout(120)
    if big and SHOT: pg.screenshot(path=SHOT + 'moede.png')
    pg.evaluate("Kaperen.game.state.skrog = 900; Kaperen.game.state.mandskab = 16; Kaperen.refresh()")
    check(pg, 'møde: sørøver', '#game', w, h, tag + '-moede-start.png')
    pg.click('#btn-skyd'); pg.wait_for_timeout(80)
    if 'Du skyder' not in st(pg, "document.getElementById('moede-log').textContent"): fails.append(tag + ' Skyd gav ingen tekst')
    check(pg, 'møde: kamp', '#game', w, h, tag + '-moede-kamp.png')
    if big and SHOT:
        pg.evaluate("(() => { const g = Kaperen.game; g.state.skrog = Math.min(g.state.skrog, g.maxSkrog() - 8); Kaperen.refresh(); })()")
        pg.screenshot(path=SHOT + 'moede-kamp.png')
    for _ in range(12):
        if st(pg, "!!Kaperen.game.state.moede.slut"): break
        if st(pg, "Kaperen.game.state.moede.afstand") > 0: pg.click('#btn-naermere')
        else: pg.click('#btn-bord')
        pg.wait_for_timeout(30)
    if st(pg, "Kaperen.game.state.moede.slut") is None: fails.append(tag + ' kampen sluttede ikke')
    else:
        if st(pg, "document.getElementById('moede-knapper').dataset.fase") != 'slut': fails.append(tag + ' Sejl videre vises ikke')
        check(pg, 'møde: slut', '#game', w, h, tag + '-moede-slut.png')
        pg.keyboard.press('Enter') if st(pg, "document.activeElement.id") == 'btn-videre' else pg.click('#btn-videre')
        pg.wait_for_timeout(80)
        if st(pg, "Kaperen.view") != 'hav': fails.append(tag + ' Sejl videre efter kampen gik ikke tilbage til havet')
        check(pg, 'hav efter mødet', '#game', w, h, tag + '-hav-efter.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        if not st(pg, "document.getElementById('btn-land').disabled"): fails.append(tag + ' Gå i land kan vælges til søs')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
    # Handelsskib: fredeligt, "Sejl videre"
    moede_state(pg, 'handel'); pg.wait_for_timeout(100)
    if st(pg, "document.querySelector('#btn-flygt .big').textContent") != 'Sejl videre': fails.append(tag + ' fredeligt skib: ingen Sejl videre')
    check(pg, 'møde: handelsskib', '#game', w, h, tag + '-moede-handel.png')
    pg.mouse.move(1, 1); pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.press('f'); pg.wait_for_timeout(60)
    if st(pg, "Kaperen.game.state.moede.slut") != 'videre': fails.append(tag + ' F lod ikke skibet sejle')
    # Storm
    moede_state(pg, 'storm'); pg.wait_for_timeout(100)
    check(pg, 'møde: storm', '#game', w, h, tag + '-storm.png')
    pg.click('#btn-ride'); pg.wait_for_timeout(60)
    if st(pg, "Kaperen.game.state.moede.slut") != 'overstaaet': fails.append(tag + ' storm: Rid den af virkede ikke')
    # Marinen (efterlyst)
    moede_state(pg, 'marine', 15); pg.wait_for_timeout(100)
    check(pg, 'møde: marinen', '#game', w, h, tag + '-marine.png')
    # Spil i gang (havn med last)
    ny(pg); pg.evaluate("(() => { const g = Kaperen.game; g.state.guld = 1800; g.koeb('silke', 4); g.koeb('rom', 6); g.state.beroemmelse = 6; g.state.dag = 23; Kaperen.vaelgVare('silke'); Kaperen.save(); })()")
    check(pg, 'spil i gang', '#game', w, h, tag + '.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
    # Gem og fortsæt
    pg.evaluate("Kaperen.show('menu')"); pg.wait_for_timeout(80)
    if st(pg, "[document.getElementById('btn-start-label').textContent, document.getElementById('btn-ny').hidden]") != ['Fortsæt rejsen', False]: fails.append(tag + ' menuen tilbyder ikke at fortsætte')
    check(pg, 'start (gemt rejse)', '#menu', w, h, tag + '-start-gemt.png')
    pg.click('#btn-start'); pg.wait_for_timeout(120)
    if st(pg, "[Kaperen.view, Kaperen.game.state.dag, Kaperen.game.state.last.silke]") != ['havn', 23, 4]: fails.append(tag + ' Fortsæt rejsen genskabte ikke spillet')
    # Pause og Gå i land (bekræft, Nej har fokus)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    check(pg, 'pause', '#game', w, h, tag + '-pause.png')
    pg.click('#btn-land'); pg.wait_for_timeout(80)
    if st(pg, "[document.getElementById('bekraeft-overlay').hidden, document.activeElement.id]") != [False, 'btn-bekraeft-nej']: fails.append(tag + ' bekræftelsen vises ikke / Nej har ikke fokus')
    check(pg, 'bekræft gå i land', '#game', w, h, tag + '-bekraeft.png')
    r = st(pg, """(() => { const a = document.getElementById('btn-bekraeft-nej').getBoundingClientRect(), b = document.getElementById('btn-bekraeft-ja').getBoundingClientRect();
      return Math.round(Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom)); })()""")
    if r < 32: fails.append('%s bekræft: knapperne kun %s px fra hinanden' % (tag, r))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
    if not st(pg, "document.getElementById('bekraeft-overlay').hidden") or st(pg, "!!Kaperen.game.state.over"): fails.append(tag + ' Esc i bekræftelsen lukkede ikke / afsluttede')
    pg.click('#btn-land'); pg.wait_for_timeout(60); pg.click('#btn-bekraeft-ja'); pg.wait_for_timeout(200)
    pts = st(pg, "Kaperen.game.state.over && Kaperen.game.state.over.point")
    if not pts or st(pg, "document.getElementById('slut-overlay').hidden"): fails.append(tag + ' Gå i land viste ikke slutskærmen')
    if not st(pg, "Kaperen.records.list('point').some(e => e.score === %s && e.dage === 23 && e.skib === 'slup')" % (pts or -1)): fails.append(tag + ' rekorden blev ikke gemt (med dage og skib)')
    if st(pg, "localStorage.getItem('hojtArkade.kaperen.spil')") is not None: fails.append(tag + ' den gemte rejse blev ikke slettet')
    check(pg, 'slut: gik i land', '#game', w, h, tag + '-land.png')
    # Game over: skibet synker
    moede_state(pg, 'pirat'); pg.wait_for_timeout(100)
    pg.evaluate("Kaperen.game.state.skrog = 1; Kaperen.game.state.moede.afstand = 2; Kaperen.refresh()")
    for _ in range(10):
        if st(pg, "!!Kaperen.game.state.over"): break
        pg.click('#btn-skyd'); pg.wait_for_timeout(30)
    try: pg.wait_for_function("!document.getElementById('slut-overlay').hidden", timeout=4000)
    except Exception: fails.append(tag + ' game over blev ikke vist')
    if st(pg, "Kaperen.game.state.over && Kaperen.game.state.over.grund") != 'sunket': fails.append(tag + ' skibet sank ikke')
    check(pg, 'game over', '#game', w, h, tag + '-gameover.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
    pg.click('#btn-slut-rekorder'); pg.wait_for_timeout(80)
    check(pg, 'rekorder (med point)', '#records', w, h, tag + '-rekorder-fyldt.png')
    if 'point' not in st(pg, "document.querySelector('#rec-list li').textContent"): fails.append(tag + ' rekordlisten viser ikke point')

def dwell_check(pg, w, h, tag):
    """Dwell køber, og den knap, der dukker op under blikket, vælges ikke af sig selv."""
    ny(pg); pg.evaluate("Kaperen.settings.set('dwellTime', 0.5)")
    x, y = center(pg, '[data-koeb="1"]'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Kaperen.settings.set('dwell', true)")
    try: pg.wait_for_function("Object.values(Kaperen.game.state.last).reduce((a, b) => a + b, 0) >= 1", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Køb 1 købte ikke')
    pg.mouse.move(1, 1); pg.wait_for_timeout(50)
    # Til søs: knappen (eller nabofeltet) under blikket på havet må ikke aktiveres af sig selv
    d0 = st(pg, "Kaperen.game.state.dag")
    x, y = center(pg, '#btn-til-soes'); pg.mouse.move(x, y, steps=2)
    try: pg.wait_for_function("Kaperen.view === 'hav'", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Til søs viste ikke havet')
    pg.wait_for_timeout(1500)
    if st(pg, "Kaperen.view") != 'hav' or st(pg, "Kaperen.game.state.dag") != d0: fails.append(tag + ' dwell valgte noget af sig selv på havet')
    # Dwell på en retning sejler (og gentager, så længe blikket bliver)
    ret = st(pg, "[...document.querySelectorAll('.ret-btn[data-ret]')].filter(b => !b.disabled).map(b => b.dataset.ret)")
    if ret:
        pg.evaluate("Kaperen.game.state.proviant = 40")
        x, y = center(pg, '.ret-btn[data-ret="%s"]' % ret[0]); pg.mouse.move(x, y, steps=2)
        try: pg.wait_for_function("Kaperen.game.state.dag > %d || Kaperen.view !== 'hav'" % d0, timeout=4000)
        except Exception: fails.append(tag + ' dwell på en retning sejlede ikke')
    pg.evaluate("Kaperen.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        big = (w, h) == (1920, 1080)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'startskaerm.png')
        if st(pg, "document.getElementById('btn-hall').dataset.href") != '../index.html': fails.append(tag + ' Tilbage til hallen peger forkert')
        pg.evaluate("Kaperen.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Kaperen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Kaperen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        gameplay(pg, w, h, tag, big)
        # Glød kan slås fra
        ny(pg); pg.click('#btn-til-soes'); pg.wait_for_timeout(80)
        if st(pg, "Kaperen.view") != 'hav': fails.append(tag + ' Til søs viste ikke havet (glød)')
        pg.evaluate("Kaperen.gameSettings.set('gloed', false)"); pg.wait_for_timeout(200)
        g = pg.evaluate("""() => [document.documentElement.dataset.kapGloed, getComputedStyle(document.querySelector('.hud-value')).textShadow,
                    getComputedStyle(document.documentElement).getPropertyValue('--kap-gloed-filter').trim(), document.querySelectorAll('#kap-grafik symbol').length]""")
        if g[0] != 'fra' or g[1] != 'none' or 'transparent' not in g[2] or g[3] < 40: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'hav uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Kaperen.gameSettings.set('gloed', true)")
        dwell_check(pg, w, h, tag)
        ctx.close()
    # Mindre bevægelse: ingen sejlanimation, ingen overgange
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    ny(pg); pg.click('#btn-til-soes')
    pg.evaluate("(() => { const g = Kaperen.game, st = g.state; st.guld = 500; g.rygteHavn(); st.set = st.set.replace(/0/g, '1'); st.proviant = 40; Kaperen.aabnKort(); Kaperen.vaelgHavn(g.kendteHavne().filter(i => i !== st.havn)[0]); })()")
    d0 = st(pg, "Kaperen.game.state.dag")
    pg.click('#btn-kurs'); pg.wait_for_timeout(100)
    a = st(pg, "[document.documentElement.classList.contains('kap-stille'), Kaperen.sejler, Kaperen.view !== 'kort', Kaperen.game.state.dag > %d]" % d0)
    ok = a == [True, False, True, True]
    print('%s reduced motion: stille/sejler/videre/dage gået=%s' % ('OK  ' if ok else 'FEJL', a))
    if not ok: fails.append('reduced motion: %s' % a)
    ctx.close()
    # Hallen med Kaperen aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.on('console', lambda m: hall_errs.append(m.text) if m.type == 'error' else None)
    pg.goto(HALL + '?spil=kaperen'); pg.wait_for_timeout(1500)
    tt = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Kaperen/.test(t))""")
    print('     hallen: %s, fejl %s' % (tt, hall_errs))
    if 'Spil Kaperen' not in tt or hall_errs: fails.append('hallen viser ikke Kaperen som aktiv: %s %s' % (tt, hall_errs))
    if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
    ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)
