# Responsiv test af Pixelgåder: alle skærme ved 8 opløsninger (+ 2560 × 1440 for 15 × 15).
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (felterne på gitteret tæller ikke med – deres størrelse
# vises som felt=..px) og ingen fejl i konsollen.
#
# Desuden spillet i browseren: værktøjerne Udfyld, Kryds og Visk med mus og tastatur,
# fejl og liv, tip, løst gåde med billedets navn, Næste gåde, bekræftelsen ved Afslut,
# game over efter tre fejl, rekorder og dwell (ét dwell = én handling).
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 pixelgaader/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     PIXELGAADER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('PIXELGAADER_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390),(2560,1440)]
# Størrelser, der skal kunne vælges (felter på mindst ca. 72 px; 5 × 5 altid)
WANT = {(1920,1080): ['5x5','8x8','10x10'], (1366,768): ['5x5','8x8'], (1280,720): ['5x5','8x8'], (1024,768): ['5x5','8x8'],
        (1024,1366): ['5x5','8x8','10x10'], (1366,1024): ['5x5','8x8','10x10'], (390,844): ['5x5'], (844,390): ['5x5'],
        (2560,1440): ['5x5','8x8','10x10','15x15']}
MIN_BTN = 80
errs=[]; fails=[]; summary={}
CHECK = """(sel) => {
  const se = document.scrollingElement, W = se.clientWidth, H = se.clientHeight;
  const vis = e => !e.closest('[hidden]') && !e.closest('.trin-skjult') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const out = {scroll: se.scrollHeight > se.clientHeight || se.scrollWidth > se.clientWidth, inner: [], clipped: [], overlap: [], textOut: []};
  document.querySelectorAll('.screen, .overlay').forEach(s => {
     if (s.closest('[hidden]')) return;
     if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) out.inner.push((s.id||s.className) + ' ' + s.scrollWidth + 'x' + s.scrollHeight + '/' + s.clientWidth + 'x' + s.clientHeight); });
  const scr = document.querySelector(sel);
  scr.querySelectorAll('button, a, canvas, h1, h2, h3, p, li, .hud, img, .setting-label, .trin-label, .value-box').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
  });
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => !e.classList.contains('cell'));
  const cells = [...scr.querySelectorAll('#board .cell')].filter(vis);
  out.cellPx = cells.length ? Math.round(cells[0].getBoundingClientRect().width) : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.tool || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // Hvis et overlay er åbent, tæller kun dets knapper (resten ligger bag det)
  const ov = [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const counted = ov ? bs.filter(e => ov.contains(e)) : bs;
  const z = e => { let f = 1; for (let n = e; n; n = n.parentElement) { const zz = parseFloat(n.style && n.style.zoom); if (zz) f *= zz; } return f; };
  const sizes = counted.map(e => { const r = e.getBoundingClientRect(); return [Math.round(Math.min(r.width, r.height)), name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]; }).sort((a, b) => a[0] - b[0]);
  counted.forEach(e => { if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) out.textOut.push(name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth); });
  out.minBtn = sizes.length ? sizes[0][0] : null;
  out.minName = sizes.length ? sizes[0][1] : '';
  out.zoomed = [...document.querySelectorAll('*')].some(e => e.style && e.style.zoom && !e.closest('[hidden]'));
  return out; }"""
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_BTN
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn
    extra = ''
    if sel == '#game': extra = ' layout=%s felt=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['cellPx'])
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + shot)
def pages(pg, scr, w, h, name, shotbase):
    """Gå alle sider igennem på en skærm med Forrige/Næste."""
    n = 1
    while True:
        check(pg, '%s side %d' % (name, n), scr, w, h, shotbase and '%s-trin%d.png' % (shotbase, n))
        nxt = pg.locator(scr + ' .trin-nav:not([hidden]) .trin-next')
        if nxt.count() == 0 or nxt.is_disabled(): break
        nxt.click(); pg.wait_for_timeout(60); n += 1
        if n > 8: fails.append('for mange sider ' + name); break
    return n

# En plade, hvor midterlampen og dens naboer er tændt: ét tryk i midten løser den.
ONE = """() => { const r = LysUd.run, n = r.n, c = Math.floor(n/2) * n + Math.floor(n/2), G = LysUdGame;
  r._setBoard(G.press(G.emptyBoard(n), n, c)); LysUd.refresh(); return c; }"""
# En plade midt i spillet: et par tryk, så der er både tændte og slukkede lamper.
MID = """() => { const r = LysUd.run, n = r.n, G = LysUdGame;
  r._setBoard(G.applyPresses(G.emptyBoard(n), n, [0, n + 2, 2*n + 4, 3*n + 1, n*n - 1])); r.tap(n*n - 1 - n); LysUd.refresh(); }"""
def cls(pg, c):
    return pg.evaluate("c => [...document.querySelectorAll('#board .cell')].map((e, i) => e.classList.contains(c) ? i : -1).filter(i => i >= 0)", c)
def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    print('     %dx%d bekræft: Nej %spx, Ja %spx, afstand %spx' % (w, h, r[0], r[1], r[2]))
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def st(pg, expr): return pg.evaluate(expr)
def sol_cells(pg): return pg.evaluate("Pixelgaader.run.state.puzzle.sol.map((v,i)=>v?i:-1).filter(i=>i>=0)")
# Tomme felter i billedet, som endnu ikke er krydset (heller ikke automatisk)
def empty_cells(pg): return pg.evaluate("Pixelgaader.run.state.puzzle.sol.map((v,i)=>v||Pixelgaader.run.state.mark[i]?-1:i).filter(i=>i>=0)")
def cell_center(pg, i):
    bb = pg.locator('#board .cell').nth(i).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def click_cell(pg, i):
    x, y = cell_center(pg, i); pg.mouse.click(x, y); pg.wait_for_timeout(40)
def gameplay(pg, w, h, tag):
    """Spillet med mus/tryk og tastatur på en 5 × 5."""
    pg.evaluate("Pixelgaader.gameSettings.set('mode','5x5'); Pixelgaader.start()"); pg.wait_for_timeout(150)
    s, e = sol_cells(pg), empty_cells(pg)
    # Udfyld (standardværktøj): et rigtigt felt farves
    click_cell(pg, s[0])
    if st(pg, "Pixelgaader.run.state.mark[%d]" % s[0]) != 1: fails.append(tag + ' Udfyld farvede ikke feltet')
    e = empty_cells(pg)
    # Kryds: vælg værktøjet med knappen
    pg.click('#tools [data-tool=kryds]'); pg.wait_for_timeout(40)
    click_cell(pg, e[0])
    if st(pg, "[Pixelgaader.run.state.mark[%d], Pixelgaader.run.state.lives]" % e[0]) != [2, 3]: fails.append(tag + ' Kryds virkede ikke')
    if 'x' not in pg.locator('#board .cell').nth(e[0]).get_attribute('class').split(): fails.append(tag + ' kryds tegnes ikke')
    # Visk fjerner krydset
    pg.click('#tools [data-tool=visk]'); pg.wait_for_timeout(40)
    click_cell(pg, e[0])
    if st(pg, "Pixelgaader.run.state.mark[%d]" % e[0]) != 0: fails.append(tag + ' Visk virkede ikke')
    # Fejl: et liv mindre, feltet vises som tomt
    pg.click('#tools [data-tool=udfyld]'); pg.wait_for_timeout(40)
    click_cell(pg, e[1])
    r = st(pg, "[Pixelgaader.run.state.lives, Pixelgaader.run.state.lock[%d], document.querySelectorAll('#hud-lives .on').length, document.getElementById('hint').className]" % e[1])
    if r != [2, 'fejl', 2, 'hint err']: fails.append('%s fejl gav %s' % (tag, r))
    # Tastatur: piletast viser markøren i midten, X krydser, V visker, F farver
    pg.mouse.move(1, 1); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    cur = st(pg, "Pixelgaader.cursor")
    if cur != 12: fails.append('%s markøren startede i %s' % (tag, cur))
    for k in ['ArrowLeft', 'ArrowLeft', 'ArrowUp']: pg.keyboard.press(k)
    cur = st(pg, "Pixelgaader.cursor")
    if cur != 5: fails.append('%s piletasterne flyttede til %s' % (tag, cur))
    mk = st(pg, "Pixelgaader.run.state.mark[5]")
    if mk == 0:
        pg.keyboard.press('x'); pg.wait_for_timeout(30)
        if st(pg, "Pixelgaader.run.state.mark[5]") != 2: fails.append(tag + ' X krydsede ikke')
        pg.keyboard.press('v'); pg.wait_for_timeout(30)
        if st(pg, "Pixelgaader.run.state.mark[5]") != 0: fails.append(tag + ' V viskede ikke')
    pg.keyboard.press('2'); pg.wait_for_timeout(30)
    if st(pg, "Pixelgaader.tool") != 'kryds': fails.append(tag + ' tast 2 valgte ikke Kryds')
    pg.keyboard.press('1'); pg.wait_for_timeout(30)
    # Tip
    pts = st(pg, "Pixelgaader.run.state.hints")
    pg.click('#btn-tip'); pg.wait_for_timeout(40)
    if st(pg, "Pixelgaader.run.state.hints") != pts + 1 or st(pg, "document.querySelectorAll('#board .cell.tip').length") != 1: fails.append(tag + ' tip virkede ikke')
def solve_all(pg):
    pg.evaluate("() => { const r = Pixelgaader.run; r.state.puzzle.sol.forEach((v,i) => { if (v && r.state.mark[i] !== 1) { if (r.state.mark[i] === 2 && !r.state.lock[i]) r.erase(i); Pixelgaader.act(i, 'udfyld'); } }); }")
def dwell_check(pg, w, h, tag):
    """Ét dwell = én handling på et felt, og dwell virker på værktøjsknapperne."""
    pg.evaluate("Pixelgaader.gameSettings.set('mode','5x5'); Pixelgaader.start(); Pixelgaader.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(120)
    s = sol_cells(pg); e = empty_cells(pg)
    x, y = center(pg, '#tools [data-tool=kryds]'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Pixelgaader.settings.set('dwell', true)")
    try: pg.wait_for_function("Pixelgaader.tool === 'kryds'", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Kryds valgte ikke værktøjet')
    x, y = cell_center(pg, e[0]); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Pixelgaader.run.state.mark[%d] === 2" % e[0], timeout=3000)
    except Exception: fails.append(tag + ' dwell på et felt krydsede ikke')
    pg.wait_for_timeout(1600)  # blikket bliver: ingen gentagelse (krydset bliver ikke viskes eller andet)
    if st(pg, "Pixelgaader.run.state.mark[%d]" % e[0]) != 2: fails.append(tag + ' dwell gentog handlingen')
    pg.evaluate("Pixelgaader.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        av = pg.evaluate("Pixelgaader.availableSizes()")
        shown = pg.evaluate("[...document.querySelectorAll('#menu [data-mode]')].filter(b => !b.hidden).map(b => b.dataset.mode)")
        cells = pg.evaluate("['5x5','8x8','10x10','15x15'].map(s => Math.round(Pixelgaader.cellSizeFor(s)))")
        print('     %dx%d størrelser %s (felt 5/8/10/15 = %s px) note: %s' % (w, h, av, cells, pg.evaluate("document.getElementById('size-note').textContent")))
        if av != WANT[(w, h)]: fails.append('%s størrelser %s, ventede %s' % (tag, av, WANT[(w, h)]))
        if shown != ['stigende'] + av: fails.append('%s menuen viser %s' % (tag, shown))
        pg.evaluate("Pixelgaader.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Pixelgaader.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Pixelgaader.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        # Alle størrelser, skærmen tilbyder: entydig gåde, felterne store nok
        for size in av:
            pg.evaluate("s => { Pixelgaader.gameSettings.set('mode', s); Pixelgaader.start(); }", size); pg.wait_for_timeout(150)
            u = pg.evaluate("() => { const p = Pixelgaader.run.state.puzzle; return [p.size, PixelgaaderGame.countSolutions(p.clues, p.n, 2)]; }")
            if u != [size, 1]: fails.append('%s %s gåde forkert %s' % (tag, size, u))
            check(pg,'spil '+size,'#game',w,h, size == av[-1] and tag + '-spil-%s.png' % size)
            c = pg.evaluate("Math.round(document.querySelector('#board .cell').getBoundingClientRect().width)")
            if size != '5x5' and c < 72: fails.append('%s %s felter kun %s px' % (tag, size, c))
        gameplay(pg, w, h, tag)
        # Glød kan slås fra: ingen lysskær, spillet ser ens ud i opbygning
        pg.evaluate("Pixelgaader.gameSettings.set('gloed', false)"); pg.wait_for_timeout(400)
        g = pg.evaluate("""() => { const c = document.querySelector('#board .cell.f .mk') || document.querySelector('#board .cell.f');
            return [document.documentElement.dataset.pgGloed, c ? getComputedStyle(c).boxShadow : 'none', getComputedStyle(document.querySelector('#board')).boxShadow,
                    document.querySelectorAll('#pg-ikoner symbol').length]; }""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] != 'none' or g[3] < 7: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Pixelgaader.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        check(pg,'spil 5x5 i gang','#game',w,h, tag+'.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # Løst gåde: billedets navn vises
        solve_all(pg); pg.wait_for_timeout(1000)
        if pg.evaluate("document.getElementById('done-overlay').hidden"): fails.append(tag + ' Gåde løst blev ikke vist')
        nm = pg.evaluate("[document.getElementById('done-title').textContent, Pixelgaader.run.state.puzzle.name]")
        if nm[0] != nm[1] or not nm[0]: fails.append('%s navnet vises ikke %s' % (tag, nm))
        check(pg,'gåde løst','#game',w,h, tag+'-loest.png')
        pts = pg.evaluate("Pixelgaader.run.state.score")
        pg.click('#btn-done-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (gåde løst)', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if pg.evaluate("[document.getElementById('confirm-overlay').hidden, document.getElementById('done-overlay').hidden, Pixelgaader.run.state.ended]") != [True, False, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        pg.click('#btn-next'); pg.wait_for_timeout(100)
        if pg.evaluate("[Pixelgaader.run.state.index, Pixelgaader.run.state.solvedCount, Pixelgaader.run.state.lives]") != [1, 1, 3]: fails.append(tag + ' Næste gåde virkede ikke')
        check(pg,'gåde 2','#game',w,h)
        # Game over: tre fejl i samme gåde
        e = empty_cells(pg)
        for i in e[:3]: pg.evaluate("i => Pixelgaader.act(i, 'udfyld')", i)
        pg.wait_for_timeout(2200)
        if pg.evaluate("document.getElementById('gameover').hidden"): fails.append(tag + ' game over blev ikke vist')
        rec = pg.evaluate("Pixelgaader.records.list('5x5').some(e => e.levels === 1 && e.score === %d)" % pts)
        if not rec: fails.append(tag + ' rekorden blev ikke gemt')
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)
