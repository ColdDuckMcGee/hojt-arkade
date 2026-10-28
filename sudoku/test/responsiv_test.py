# Responsiv test af Sudoku: alle skærme ved de 8 opløsninger fra den fælles brief.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px (pladens felter tæller ikke med som knapper – deres størrelse
# vises som felt=..px; felterne i en zoomet boks skal være mindst ca. 72 px og bokseknapperne
# i oversigten mindst 80 px), og ingen fejl i konsollen.
#
# Desuden spillet i browseren: fire sværheder i menuen, vælg boks (zoom) → felt → tal med musen,
# forkert tal koster point (ingen liv, ingen game over), noter, visk, fortryd (uden refusion),
# tip, tastaturet, glød fra, løst gåde, Næste gåde, Afslut serien → "Serien er slut",
# rekorder (også Ekspert), en Ekspert-gåde og dwell (ét dwell = én handling).
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 sudoku/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     SUDOKU_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('SUDOKU_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
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
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => !e.classList.contains('cell') && !e.classList.contains('boxbtn'));
  const cells = [...scr.querySelectorAll('#board .cell')].filter(vis);
  const zc = cells.filter(e => e.classList.contains('inzoom')), oc = cells.filter(e => !e.classList.contains('inzoom'));
  const mn = a => a.length ? Math.round(Math.min(...a.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }))) : null;
  out.cellPx = mn(zc.length ? zc : cells); out.smallCellPx = zc.length ? mn(oc) : null;
  out.boxPx = mn([...scr.querySelectorAll('#board .boxbtn')].filter(vis).filter(e => getComputedStyle(e).pointerEvents !== 'none'));
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
    if sel == '#game': extra = ' layout=%s plade=%spx felt=%spx%s boks=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), pg.evaluate("document.querySelector('#game').dataset.board"), r['cellPx'], (' (øvrige %spx)' % r['smallCellPx']) if r['smallCellPx'] else '', r['boxPx'])
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

def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    print('     %dx%d bekræft: Nej %spx, Ja %spx, afstand %spx' % (w, h, r[0], r[1], r[2]))
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))
def st(pg, expr): return pg.evaluate(expr)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def cell_center(pg, i):
    bb = pg.locator('#board .cell').nth(i).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def click_cell(pg, i):
    x, y = cell_center(pg, i); pg.mouse.click(x, y); pg.wait_for_timeout(60)
def click_box(pg, b):
    x, y = center(pg, '#board .boxbtn[data-box="%d"]' % b); pg.mouse.click(x, y); pg.wait_for_timeout(120)
EMPTY = "b => { const s = Sudoku.run.state; return SudokuGame.boxCells(b).filter(i => !s.grid[i]); }"
def best_box(pg):
    return pg.evaluate("() => { const s = Sudoku.run.state; let best = 0, n = -1; for (let b = 0; b < 9; b++) { const e = SudokuGame.boxCells(b).filter(i => !s.grid[i]).length; if (e > n) { n = e; best = b; } } return best; }")
def sol(pg, i): return pg.evaluate("i => Sudoku.run.state.puzzle.sol[i]", i)
def wrong(pg, i): return 1 if sol(pg, i) != 1 else 2
def gameplay(pg, w, h, tag):
    """Spillet med mus/tryk og tastatur: boks → felt → tal."""
    pg.evaluate("Sudoku.gameSettings.set('mode','let'); Sudoku.start()"); pg.wait_for_timeout(150)
    b = best_box(pg)
    click_box(pg, b)
    if st(pg, "Sudoku.zoom") != b: fails.append('%s boksen zoomede ikke (%s)' % (tag, st(pg, "Sudoku.zoom")))
    check(pg, 'zoomet boks', '#game', w, h, tag + '-zoom.png')
    zc = pg.evaluate("Math.round(Math.min(...[...document.querySelectorAll('#board .cell.inzoom')].map(e => e.getBoundingClientRect().width)))")
    if zc < 72: fails.append('%s felterne i den zoomede boks er kun %s px' % (tag, zc))
    e = pg.evaluate(EMPTY, b)
    click_cell(pg, e[0])
    if st(pg, "Sudoku.sel") != e[0]: fails.append(tag + ' feltet blev ikke valgt')
    pg.click('#pad [data-digit="%d"]' % sol(pg, e[0])); pg.wait_for_timeout(60)
    if st(pg, "Sudoku.run.state.grid[%d]" % e[0]) != sol(pg, e[0]): fails.append(tag + ' tallet blev ikke sat')
    # Forkert tal: minuspoint (tydeligt i linjen, uden blink), vises som forkert, ingen liv
    pg.evaluate("Sudoku.run.state.score = 30; Sudoku.refresh()")
    click_cell(pg, e[1]); pg.click('#pad [data-digit="%d"]' % wrong(pg, e[1])); pg.wait_for_timeout(60)
    r = st(pg, """[Sudoku.run.state.score, document.getElementById('hud-score').textContent, document.getElementById('hud-errors').textContent,
        document.querySelector('#board .cell[data-i=\"%d\"]').classList.contains('wrong'), document.getElementById('hint').className,
        /−5 point/.test(document.getElementById('hint').textContent), getComputedStyle(document.getElementById('hint')).animationName,
        'lives' in Sudoku.run.state, !!document.getElementById('hud-lives')]""" % e[1])
    if r != [25, '25', '1', True, 'hint err', True, 'none', False, False]: fails.append('%s fejl gav %s' % (tag, r))
    check(pg, 'forkert tal', '#game', w, h, (big or small) and tag + '-fejl.png')
    # Fortryd fjerner tallet, men giver ikke point tilbage
    pg.click('#btn-undo'); pg.wait_for_timeout(60)
    if st(pg, "[Sudoku.run.state.score, Sudoku.run.state.errors, Sudoku.run.state.undoLeft, document.getElementById('btn-undo').disabled, Sudoku.run.state.wrong[%d]]" % e[1]) != [25, 1, 0, True, 0]: fails.append(tag + ' fortryd virkede ikke')
    pg.evaluate("Sudoku.run.state.score = 0; Sudoku.refresh()")
    # Noter: blyantstal i feltet, Visk fjerner dem
    pg.click('#btn-notes'); pg.wait_for_timeout(40)
    click_cell(pg, e[1]); pg.click('#pad [data-digit="1"]'); pg.click('#pad [data-digit="5"]'); pg.wait_for_timeout(40)
    if st(pg, "Sudoku.run.state.notes[%d]" % e[1]) != (1 << 1) | (1 << 5): fails.append(tag + ' noter virkede ikke (%s)' % st(pg, "Sudoku.run.state.notes[%d]" % e[1]))
    if st(pg, "document.querySelector('#board .cell[data-i=\"%d\"]').classList.contains('notes')" % e[1]) is not True: fails.append(tag + ' noterne tegnes ikke')
    check(pg, 'noter', '#game', w, h, tag + '-noter.png')
    pg.click('#btn-erase'); pg.wait_for_timeout(40)
    if st(pg, "Sudoku.run.state.notes[%d]" % e[1]) != 0: fails.append(tag + ' Visk fjernede ikke noterne')
    pg.click('#btn-notes'); pg.wait_for_timeout(40)
    # Tip koster point og udfylder det valgte felt
    pg.click('#btn-tip'); pg.wait_for_timeout(60)
    if st(pg, "[Sudoku.run.state.tips, Sudoku.run.state.grid[%d] === Sudoku.run.state.puzzle.sol[%d], document.querySelectorAll('#board .cell.tip').length]" % (e[1], e[1])) != [1, True, 1]: fails.append(tag + ' tip virkede ikke')
    # Hele pladen
    pg.click('#btn-overview'); pg.wait_for_timeout(100)
    if st(pg, "Sudoku.zoom") != -1: fails.append(tag + ' Hele pladen virkede ikke')
    # Tastatur: piletast vælger midterfeltet, O og 1–9
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    s0 = st(pg, "Sudoku.sel")
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(40)
    if st(pg, "Sudoku.sel") != min(80, s0 + 9) and s0 < 72: fails.append('%s piletasterne flyttede ikke (%s → %s)' % (tag, s0, st(pg, "Sudoku.sel")))
    i = pg.evaluate("() => Sudoku.run.state.grid.findIndex(v => !v)")
    pg.evaluate("i => Sudoku.select(i)", i)
    pg.keyboard.press(str(sol(pg, i))); pg.wait_for_timeout(40)
    if st(pg, "Sudoku.run.state.grid[%d]" % i) != sol(pg, i): fails.append(tag + ' tast 1–9 satte ikke tallet')
    pg.keyboard.press('n'); pg.wait_for_timeout(30)
    if st(pg, "Sudoku.notesMode") is not True: fails.append(tag + ' N slog ikke noter til')
    pg.keyboard.press('n'); pg.wait_for_timeout(30)
def solve_all(pg):
    pg.evaluate("() => { Sudoku.overview(); const s = Sudoku.run.state; s.grid.forEach((v, i) => { if (!v) Sudoku.run.place(i, s.puzzle.sol[i]); }); Sudoku.refresh(); Sudoku.showDone(); }")
def dwell_check(pg, w, h, tag):
    """Dwell: boks → felt → tal, og ét dwell = én handling."""
    pg.evaluate("Sudoku.gameSettings.set('mode','let'); Sudoku.start(); Sudoku.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(150)
    pg.mouse.move(1, 1)
    pg.evaluate("Sudoku.settings.set('dwell', true)")
    b = best_box(pg)
    x, y = center(pg, '#board .boxbtn[data-box="%d"]' % b); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Sudoku.zoom === %d" % b, timeout=3000)
    except Exception: fails.append(tag + ' dwell på en boks zoomede ikke')
    pg.wait_for_timeout(500)
    e = pg.evaluate(EMPTY, b)
    x, y = cell_center(pg, e[0]); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Sudoku.sel === %d" % e[0], timeout=3000)
    except Exception: fails.append(tag + ' dwell på et felt valgte det ikke')
    d = sol(pg, e[0])
    x, y = center(pg, '#pad [data-digit="%d"]' % d); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Sudoku.run.state.grid[%d] === %d" % (e[0], d), timeout=3000)
    except Exception: fails.append(tag + ' dwell på et tal satte det ikke')
    pg.wait_for_timeout(1600)
    if st(pg, "[Sudoku.run.state.errors, Sudoku.run.state.grid.filter(v => v).length - Sudoku.run.state.puzzle.givens.filter(v => v).length]") != [0, 1]: fails.append(tag + ' dwell gentog handlingen')
    pg.evaluate("Sudoku.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        tag = 'responsiv-%dx%d' % (w, h)
        big = (w, h) == (1920, 1080)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, big and 'startskaerm.png')
        hb = pg.evaluate("Math.round(Math.min(document.getElementById('btn-hall').getBoundingClientRect().width, document.getElementById('btn-hall').getBoundingClientRect().height))")
        if hb < MIN_BTN: fails.append('%s Tilbage til hallen er kun %s px' % (tag, hb))
        if pg.evaluate("[...document.querySelectorAll('#menu [data-mode]')].map(b => b.dataset.mode).join()") != 'let,mellem,svaer,ekspert': fails.append(tag + ' menuen har ikke fire sværheder')
        for m in ['let', 'mellem', 'svaer', 'ekspert']:
            pg.click('#menu [data-mode=%s]' % m); pg.wait_for_timeout(30)
            if st(pg, "Sudoku.gameSettings.get('mode')") != m: fails.append(tag + ' sværhed %s kunne ikke vælges' % m)
        check(pg,'start (Ekspert valgt)','#menu',w,h, small and tag+'-ekspert-valgt.png')
        pg.click('#menu [data-mode=let]')
        pg.evaluate("Sudoku.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Sudoku.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Sudoku.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h)
        pg.click('#records [data-rec-mode=ekspert]'); pg.wait_for_timeout(60); check(pg,'rekorder (Ekspert)','#records',w,h, big and 'rekorder.png')
        pg.click('#records [data-rec-mode=let]'); pg.wait_for_timeout(40)
        pg.evaluate("Sudoku.show('menu')"); pg.click('#btn-start'); pg.wait_for_timeout(200)
        u = pg.evaluate("() => { const p = Sudoku.run.state.puzzle; return [Sudoku.run.state.diff, SudokuGame.countSolutions(p.givens, 2)]; }")
        if u != ['let', 1]: fails.append('%s gåden er forkert %s' % (tag, u))
        check(pg,'spil (hele pladen)','#game',w,h)
        gameplay(pg, w, h, tag)
        # Glød kan slås fra: ingen lysskær
        pg.evaluate("Sudoku.gameSettings.set('gloed', false)"); pg.wait_for_timeout(400)
        g = pg.evaluate("""() => [document.documentElement.dataset.suGloed, getComputedStyle(document.querySelector('#board')).boxShadow,
             getComputedStyle(document.querySelector('#board .cell.placed .v') || document.querySelector('#board .cell .v')).textShadow, document.querySelectorAll('[id^=su-ikon-]').length]""")
        if g[0] != 'fra' or g[1] != 'none' or g[3] < 7: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, small and tag+'-uden-gloed.png')
        pg.evaluate("Sudoku.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        # Et billede af et spil i gang: zoomet boks med valgt felt og noter
        bb = best_box(pg); pg.evaluate("b => Sudoku.zoomTo(b)", bb); pg.wait_for_timeout(450)
        e = pg.evaluate(EMPTY, bb)
        if len(e) >= 2:
            pg.evaluate("e => { Sudoku.select(e[1]); Sudoku.toggleNotes(); Sudoku.digit(2); Sudoku.digit(7); Sudoku.toggleNotes(); Sudoku.select(e[0]); }", e)
        pg.mouse.move(1, 1); pg.wait_for_timeout(450)
        check(pg,'spil i gang','#game',w,h, tag+'.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        solve_all(pg); pg.wait_for_timeout(300)
        if pg.evaluate("document.getElementById('done-overlay').hidden"): fails.append(tag + ' Gåde løst blev ikke vist')
        check(pg,'gåde løst','#game',w,h, (small or big) and tag+'-loest.png')
        pts = pg.evaluate("Sudoku.run.state.score")
        pg.click('#btn-done-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (gåde løst)', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if pg.evaluate("[document.getElementById('confirm-overlay').hidden, document.getElementById('done-overlay').hidden]") != [True, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        pg.click('#btn-next'); pg.wait_for_timeout(150)
        if pg.evaluate("[Sudoku.run.state.index, Sudoku.run.state.solvedCount, Sudoku.run.state.errors, Sudoku.run.state.undoLeft, document.getElementById('hud-errors').textContent]") != [1, 1, 0, 1, '0']: fails.append(tag + ' Næste gåde virkede ikke')
        check(pg,'gåde 2','#game',w,h)
        # To forkerte tal: kun minuspoint, ingen game over
        pg.evaluate("""() => { const s = Sudoku.run.state; const e = s.grid.map((v, i) => v ? -1 : i).filter(i => i >= 0).slice(0, 2);
            e.forEach(i => { Sudoku.zoomTo(SudokuGame.box(i), i); Sudoku.digit(s.puzzle.sol[i] === 1 ? 2 : 1); }); }""")
        pg.wait_for_timeout(1800)
        left = max(0, pts - 2 * 5)
        r = pg.evaluate("[document.getElementById('gameover').hidden, Sudoku.run.state.score, Sudoku.run.state.errors, Sudoku.run.state.over, document.getElementById('btn-pause').disabled]")
        if r != [True, left, 2, False, False]: fails.append('%s fire fejl gav %s (ventet %s)' % (tag, r, [True, left, 2, False, False]))
        # Afslut serien → bekræft → "Serien er slut"
        pg.click('#btn-pause'); pg.wait_for_timeout(80)
        if 'Afslut serien' not in pg.inner_text('#btn-quit'): fails.append(tag + ' pauseknappen hedder ikke Afslut serien')
        pg.click('#btn-quit'); pg.wait_for_timeout(80)
        pg.click('#btn-confirm-yes'); pg.wait_for_timeout(200)
        if pg.evaluate("document.getElementById('gameover').hidden"): fails.append(tag + ' slutskærmen blev ikke vist')
        if pg.inner_text('#go-title').strip().lower() != 'serien er slut': fails.append(tag + ' slutskærmen siger %r' % pg.inner_text('#go-title'))
        if 'liv' in pg.inner_text('#gameover').lower().split(): fails.append(tag + ' slutskærmen nævner liv')
        rec = pg.evaluate("Sudoku.records.list('let').some(e => e.levels === 1 && e.score === %d)" % left) if left else True
        if not rec: fails.append(tag + ' rekorden blev ikke gemt')
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'serien er slut' + (' (resultat)' if split else ''),'#gameover',w,h, big and 'serien-er-slut.png' or (small and tag+'-gameover.png'))
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'serien er slut (rekorder)','#gameover',w,h, small and tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        # Ekspert: start fra menuen; gåden kræver par (teknikniveau 4) og har én løsning
        pg.evaluate("Sudoku.show('menu')"); pg.click('#menu [data-mode=ekspert]'); pg.wait_for_timeout(900)
        pg.click('#btn-start'); pg.wait_for_timeout(200)
        u = pg.evaluate("() => { const p = Sudoku.run.state.puzzle; return [Sudoku.run.state.diff, SudokuGame.countSolutions(p.givens, 2), SudokuGame.grade(p.givens)]; }")
        if u[:2] != ['ekspert', 1] or u[2] < 4: fails.append('%s Ekspert-gåden er %s' % (tag, u))
        check(pg,'spil (Ekspert)','#game',w,h, big and 'ekspert.png')
        solve_all(pg); pg.wait_for_timeout(300)
        if pg.evaluate("document.getElementById('done-points').textContent") != '+165 point': fails.append(tag + ' Ekspert gav ' + pg.evaluate("document.getElementById('done-points').textContent"))
        pg.click('#btn-done-quit'); pg.wait_for_timeout(80); pg.click('#btn-confirm-yes'); pg.wait_for_timeout(200)
        if not pg.evaluate("Sudoku.records.list('ekspert').some(e => e.score === 165 && e.levels === 1)"): fails.append(tag + ' Ekspert-rekorden blev ikke gemt')
        check(pg,'serien er slut (Ekspert)','#gameover',w,h)
        pg.evaluate("Sudoku.gameSettings.set('mode','let')")
        dwell_check(pg, w, h, tag)
        # Tilbage til hallen fra startskærmen
        if big:
            pg.evaluate("Sudoku.show('menu')"); pg.click('#btn-hall'); pg.wait_for_timeout(500)
            if not pg.url.endswith('/index.html') or '/sudoku/' in pg.url: fails.append(tag + ' Tilbage til hallen gik til ' + pg.url)
            else:
                pg.goto(HALL + '?spil=sudoku'); pg.wait_for_timeout(1200)
                if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
                act = pg.evaluate("""() => { const g = (window.HOJT_SPIL || []).find(g => g.sti === 'sudoku/');
                    const img = [...document.querySelectorAll('img, image')].some(e => /sudoku\\.svg/.test(e.getAttribute('src') || e.getAttribute('href') || ''));
                    return !!g && g.status === 'aktiv' && img && /Sudoku/.test(document.body.innerText); }""")
                print('%s hallen: Sudoku er aktiv med skærmbillede = %s' % ('OK  ' if act else 'FEJL', act))
                if not act: fails.append(tag + ' Sudoku er ikke aktivt i hallen')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)
