# Responsiv test af Rumhandleren: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 84 px (planet-knapperne på kortet er klikflader og tælles ikke) og ingen fejl i konsollen.
#
# Desuden spillet i browseren: vælg planet og flyv, køb og sælg (mus og tastatur), pirater,
# skibe og ruter, bygninger, kontrakter, økonomi, pause, pension, konkurs, gem/fortsæt,
# glød fra, dwell (knappen under blikket vælges ikke af sig selv) og hallen med Rumhandleren aktiv.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 rumhandleren/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     RUMHANDLEREN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('RUMHANDLEREN_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
if SHOT: os.makedirs(SHOT + 'ekstra', exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MIN_BTN = 84
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
  roots.forEach(r0 => r0.querySelectorAll('button, a, h1, h2, h3, p, li, .hud, .setting-label, .trin-label, .value-box, .scene-chip, .rh-kort, .rep').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
     // Tekst, der er klippet af sin boks (overflow hidden)
     if ((e.tagName === 'P' || e.classList.contains('scene-chip') || e.classList.contains('hud')) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)) out.textOut.push((e.id || e.className) + ' ' + e.scrollWidth + 'x' + e.scrollHeight + '>' + e.clientWidth + 'x' + e.clientHeight);
  }));
  // Nabofelterne på havet er usynlige klikflader oven på kortet (de er lige så store som et felt)
  let bs = []; roots.forEach(r0 => bs.push(...[...r0.querySelectorAll('button, a.btn')].filter(e => vis(e) && !e.classList.contains('planet-btn'))));
  const name = e => e.id || e.dataset.vare || e.dataset.planet || e.dataset.fane || e.dataset.koeb && 'koeb' + e.dataset.koeb || e.dataset.saelg && 'saelg' + e.dataset.saelg || e.dataset.byg || e.dataset.tab || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // Kortet må ikke ligge under knappanelet
  [['#kort-boks', '#v-kort .side'], ['#varer', '#v-marked .side']].forEach(([x, y]) => { const ex = scr.querySelector(x), ey = scr.querySelector(y);
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

# Et spil midt i det hele: 4 skibe (3 på ruter), bygninger, kontrakter, nyheder og begivenheder
MIDT = """(seed) => { const L = Rumhandleren.logik, g = L.createGame({ seed }), s = g.state;
  s.kredit = 60000;
  for (let i = 0; i < 12; i++) g._dag();
  g.koebSkib('pelikan'); g.koebSkib('hval'); g.koebSkib('spurv');
  const sk = s.skibe;
  g.saetRute(sk[1].id, 'kepler', 'sirius'); g.saetRute(sk[2].id, 'kepler', 'rigel');
  g.byg('lager'); g.byg('mine');
  g._nyBegivenhed(); g._nyBegivenhed();
  g.tagKontrakt(g.tilbud()[0].id);
  for (let i = 0; i < 9; i++) g._dag();
  s.flagskib && (g.flagskib().last = { mad: 6, maskiner: 4 });
  s.kredit = 23456;
  Rumhandleren.setState(g.save(), 'kort'); return true; }"""

def gameplay(pg, w, h, tag, big):
    pg.evaluate("Rumhandleren.nyHandel()"); pg.wait_for_timeout(100)
    s0 = st(pg, "[Rumhandleren.view, Rumhandleren.game.state.kredit, Rumhandleren.game.her()]")
    if s0[0] != 'kort' or s0[1] != st(pg, "Rumhandleren.logik.START.kredit"): fails.append('%s ny handel: %s' % (tag, s0))
    check(pg, 'kort (start)', '#game', w, h, tag + '-kort-start.png')
    # Vælg en planet med musen (planet-knappen på kortet)
    tgt = st(pg, "(() => { const g = Rumhandleren.game; return Rumhandleren.logik.PLANETER.map(p => p.id).filter(id => id !== g.her() && g.rejseInfo(id).kanFlyve)[0]; })()")
    pg.click('.planet-btn[data-planet=%s]' % tgt, force=True); pg.wait_for_timeout(40)
    if st(pg, "Rumhandleren.valgtPlanet") != tgt: fails.append(tag + ' planet-knappen virker ikke')
    info = st(pg, "document.getElementById('kort-info').textContent")
    if 'dag' not in info or 'Brændstof' not in info: fails.append(tag + ' kort-info mangler rejsetid/brændstof: ' + info)
    check(pg, 'kort: valgt planet', '#game', w, h, tag + '-kort-valgt.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'stjernekort.png')
    # Marked: køb med musen
    pg.click('.fane-btn[data-fane=marked]'); pg.wait_for_timeout(50)
    pg.click('#varer .vare-btn[data-vare=mad]'); pg.wait_for_timeout(30)
    k0 = st(pg, "Rumhandleren.game.state.kredit"); p = st(pg, "Rumhandleren.game.pris('mad').koeb")
    pg.click('[data-koeb="1"]'); pg.wait_for_timeout(30)
    if st(pg, "[Rumhandleren.game.flagskib().last.mad, Rumhandleren.game.state.kredit]") != [1, k0 - p]: fails.append(tag + ' Køb 1 virkede ikke')
    pg.click('[data-koeb="5"]'); pg.wait_for_timeout(30)
    if st(pg, "Rumhandleren.game.flagskib().last.mad") != 6: fails.append(tag + ' Køb 5 virkede ikke')
    if 'købte' not in st(pg, "document.getElementById('besked').textContent"): fails.append(tag + ' ingen besked efter køb')
    # Tastatur: pil højre = næste vare, K køber, venstre, Skift+S sælger 5
    pg.mouse.move(1, 1); pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('k'); pg.wait_for_timeout(30)
    v2 = st(pg, "Rumhandleren.logik.VARER[1].id")
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('Shift+S'); pg.wait_for_timeout(30)
    r = st(pg, "[Rumhandleren.game.flagskib().last['%s'] || 0, Rumhandleren.game.flagskib().last.mad || 0]" % v2)
    if r != [1, 1]: fails.append('%s tastatur køb/salg gav %s' % (tag, r))
    check(pg, 'marked', '#game', w, h, tag + '-marked.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'marked.png')
    # Flyv med tastaturet: 1 = kort, pil, Enter
    pg.keyboard.press('1'); pg.wait_for_timeout(30)
    pg.evaluate("Rumhandleren.vaelgPlanet('%s')" % tgt)
    d0 = st(pg, "Rumhandleren.game.state.dag")
    pg.click('#btn-flyv'); pg.wait_for_timeout(80)
    if st(pg, "!!document.getElementById('bekraeft-overlay').hidden") is False: pg.click('#btn-bekraeft-ja'); pg.wait_for_timeout(60)
    if st(pg, "!!Rumhandleren.game.state.moede"):
        check(pg, 'pirater', '#game', w, h, tag + '-pirat.png')
        pg.click('[data-pirat=flygt]'); pg.wait_for_timeout(60)
    if st(pg, "Rumhandleren.game.state.dag") <= d0: fails.append(tag + ' flyv: ingen dage gik')
    if st(pg, "Rumhandleren.game.state.over") is False and st(pg, "Rumhandleren.game.her()") == tgt and st(pg, "Rumhandleren.view") != 'marked': fails.append(tag + ' ankomst viser ikke markedet')
    # Vent en dag med V
    pg.keyboard.press('1'); d1 = st(pg, "Rumhandleren.game.state.dag"); pg.keyboard.press('v'); pg.wait_for_timeout(30)
    if st(pg, "Rumhandleren.game.state.dag") != d1 + 1: fails.append(tag + ' V venter ikke en dag')

    # Midt i spillet: alle sider
    pg.evaluate(MIDT, 7); pg.wait_for_timeout(100)
    check(pg, 'kort (midt i spillet)', '#game', w, h, name_tag(w, h) + '.png')
    for f in ['marked', 'skibe', 'bygninger', 'kontrakter', 'gaeld']:
        pg.click('.fane-btn[data-fane=%s]' % f); pg.wait_for_timeout(60)
        check(pg, f, '#game', w, h, tag + '-' + f + '.png')
        if big and SHOT and f in ('skibe', 'kontrakter'): pg.screenshot(path=SHOT + {'skibe': 'skibe-ruter.png', 'kontrakter': 'kontrakter.png'}[f])
        if big and SHOT and f in ('bygninger', 'gaeld'): pg.screenshot(path=SHOT + 'ekstra/' + f + '.png')
    # Kontrakter: dine
    pg.click('.fane-btn[data-fane=kontrakter]'); pg.click('[data-kliste=dine]'); pg.wait_for_timeout(40)
    check(pg, 'kontrakter: dine', '#game', w, h, tag + '-kontrakter-dine.png')
    # Skibe: ny rute via kortet
    pg.click('.fane-btn[data-fane=skibe]'); pg.wait_for_timeout(40)
    ship4 = st(pg, "Rumhandleren.game.state.skibe[3].id")
    pg.evaluate("Rumhandleren.vaelgSkib('%s')" % ship4)
    pg.click('#btn-ny-rute'); pg.wait_for_timeout(60)
    if st(pg, "Rumhandleren.view") != 'kort': fails.append(tag + ' Ny rute viser ikke kortet')
    pg.click('#btn-flyv'); pg.wait_for_timeout(40)   # vælg planet A (der hvor skibet er)
    b = st(pg, "(() => { const g = Rumhandleren.game; return Rumhandleren.logik.PLANETER.map(p => p.id).filter(id => id !== g.her() && g.adgang(id))[2]; })()")
    pg.evaluate("Rumhandleren.vaelgPlanet('%s')" % b); pg.wait_for_timeout(40)
    check(pg, 'kort: rute-valg', '#game', w, h, tag + '-rutevalg.png')
    pg.click('#btn-flyv'); pg.wait_for_timeout(60)
    if not st(pg, "!!Rumhandleren.game.skib('%s').rute" % ship4): fails.append(tag + ' ruten blev ikke sat')
    # Køb skib-boksen
    pg.click('#btn-koeb-skib'); pg.wait_for_timeout(60)
    check(pg, 'køb skib', '#game', w, h, tag + '-koeb-skib.png')
    pg.click('#btn-skib-luk'); pg.wait_for_timeout(40)
    # Byg (med bekræft)
    pg.click('.fane-btn[data-fane=bygninger]'); pg.wait_for_timeout(40)
    pg.click('[data-byg=lager]'); pg.wait_for_timeout(60)
    check(pg, 'bekræft byg', '#game', w, h, tag + '-bekraeft.png')
    pg.click('#btn-bekraeft-nej'); pg.wait_for_timeout(30)
    # Pirater (tvunget møde)
    pg.evaluate("""(() => { const g = Rumhandleren.game, s = g.state, f = g.flagskib();
      s.moede = { slags: 'pirat', fra: f.pos, til: f.pos, krav: 900, flugt: 0.6, lastVaerdi: 4500 }; s.rejse = { maal: f.pos, sti: [] };
      Rumhandleren.setState(g.save(), 'kort'); })()"""); pg.wait_for_timeout(80)
    check(pg, 'pirater', '#game', w, h, tag + '-pirat.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'ekstra/pirater.png')
    pg.click('[data-pirat=betal]'); pg.wait_for_timeout(60)
    if st(pg, "!!Rumhandleren.game.state.moede"): fails.append(tag + ' betal til pirater virkede ikke')
    # Pause og pension
    pg.click('#btn-pause'); pg.wait_for_timeout(50)
    check(pg, 'pause', '#game', w, h, tag + '-pause.png')
    pg.click('#btn-pension'); pg.wait_for_timeout(50)
    check(pg, 'bekræft pension', '#game', w, h, tag + '-pension.png')
    pg.click('#btn-bekraeft-ja'); pg.wait_for_timeout(80)
    if not st(pg, "!document.getElementById('slut-overlay').hidden"): fails.append(tag + ' pension viser ikke slut')
    check(pg, 'slut: pension', '#game', w, h, tag + '-slut-pension.png')
    # Konkurs
    pg.evaluate("""(() => { const g = Rumhandleren.logik.createGame({ seed: 3 }); g.state.kredit = 0; g.state.dag = 29; Rumhandleren.setState(g.save(), 'kort'); })()""")
    pg.wait_for_timeout(40); pg.evaluate("Rumhandleren.vent()"); pg.wait_for_timeout(80)
    if st(pg, "Rumhandleren.game.state.grund") != 'konkurs': fails.append(tag + ' konkurs virker ikke')
    check(pg, 'game over (konkurs)', '#game', w, h, tag + '-gameover.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')

def run():
    only = os.environ.get('ONLY')
    sizes = [s for s in SIZES if not only or '%dx%d' % s in only.split(',')]
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=CHROME, args=['--autoplay-policy=no-user-gesture-required'])
        for (w, h) in sizes:
            ctx = br.new_context(viewport={'width': w, 'height': h})
            pg = ctx.new_page(); pg.set_default_timeout(5000)
            pg.on('console', lambda m: m.type == 'error' and errs.append('%dx%d %s' % (w, h, m.text)))
            pg.on('pageerror', lambda e: errs.append('%dx%d %s' % (w, h, e)))
            pg.goto(URL); pg.wait_for_timeout(150)
            tag = '%dx%d' % (w, h); big = (w, h) == (1920, 1080)
            check(pg, 'menu', '#menu', w, h, tag + '-menu.png')
            if big and SHOT: pg.screenshot(path=SHOT + 'startskaerm.png')
            pg.click('#btn-om'); pg.wait_for_timeout(60); pages(pg, '#om', w, h, 'om', tag + '-om'); pg.click('#btn-om-back')
            pg.click('#btn-settings'); pg.wait_for_timeout(60)
            for t in ['styring', 'udseende', 'lyd']:
                pg.click('#settings [data-tab=%s]' % t); pg.wait_for_timeout(60); pages(pg, '#settings', w, h, 'indstillinger ' + t, tag + '-set-' + t)
            pg.click('#btn-settings-back'); pg.wait_for_timeout(40)
            pg.click('#btn-records'); pg.wait_for_timeout(60); check(pg, 'rekorder', '#records', w, h, tag + '-rekorder.png'); pg.click('#btn-records-back')
            gameplay(pg, w, h, tag, big)
            # Gem og fortsæt
            pg.evaluate(MIDT, 11); pg.evaluate("Rumhandleren.save()")
            pg.goto(URL); pg.wait_for_timeout(120)
            if 'Fortsæt' not in st(pg, "document.getElementById('btn-start-label').textContent"): fails.append(tag + ' gemt spil vises ikke')
            check(pg, 'menu (gemt spil)', '#menu', w, h, tag + '-menu-gemt.png')
            pg.click('#btn-start'); pg.wait_for_timeout(100)
            if st(pg, "Rumhandleren.game.state.skibe.length") != 4: fails.append(tag + ' fortsæt indlæste ikke spillet')
            # Glød fra
            pg.evaluate("Rumhandleren.settings.set('animation', false); Rumhandleren.gameSettings.set('gloed', false); Rumhandleren.layout()")
            check(pg, 'glød + animation fra', '#game', w, h, tag + '-gloed-fra.png')
            if st(pg, "document.documentElement.getAttribute('data-rh-gloed')") != 'fra': fails.append(tag + ' glød fra virker ikke')
            pg.evaluate("Rumhandleren.settings.set('animation', true); Rumhandleren.gameSettings.set('gloed', true); localStorage.clear()")
            ctx.close()
        # Dwell: knappen under blikket må ikke vælges af sig selv efter skærmskift
        ctx = br.new_context(viewport={'width': 1366, 'height': 768}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('dwell %s' % e))
        pg.goto(URL); pg.wait_for_timeout(100)
        pg.evaluate("Rumhandleren.settings.set('dwell', true); Rumhandleren.settings.set('dwellTime', 0.5)")
        bb = pg.locator('#btn-start').bounding_box(); pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(900)
        if st(pg, "document.getElementById('game').hidden"): fails.append('dwell: Start blev ikke valgt med dwell')
        pg.wait_for_timeout(1500)
        d = st(pg, "Rumhandleren.game ? Rumhandleren.game.state.dag : -1")
        if d != 1: fails.append('dwell: knappen under blikket blev valgt af sig selv (dag %s)' % d)
        pg.evaluate("localStorage.clear()"); ctx.close()
        # Hallen
        ctx = br.new_context(viewport={'width': 1920, 'height': 1080}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('hal %s' % e))
        pg.on('console', lambda m: errs.append('hal ' + m.text) if m.type == 'error' else None)
        pg.goto(HALL + '?spil=rumhandleren'); pg.wait_for_timeout(1500)
        tt = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Rumhandleren/.test(t))""")
        print('     hallen: %s' % tt)
        if 'Spil Rumhandleren' not in tt: fails.append('hallen viser ikke Rumhandleren som aktiv: %s' % tt)
        if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
        ctx.close(); br.close()
    print('\nMindste knap pr. opløsning:')
    for k, v in summary.items():
        m = min([x[1] for x in v if x[1] is not None] or [0]); print('  %s: %spx' % (k, m))
    print('\nKonsolfejl: %d' % len(errs)); [print('  ' + e) for e in errs]
    print('Fejl: %d' % len(fails)); [print('  ' + f) for f in fails]
    sys.exit(1 if errs or fails else 0)
run()
