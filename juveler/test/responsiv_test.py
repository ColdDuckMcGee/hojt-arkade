# Responsiv test af Juveler: alle skærme ved de 8 opløsninger fra fællesbriefen.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px (felterne på brættet tæller ikke med – deres størrelse
# vises som felt=..px) og ingen fejl i konsollen.
#
# Desuden spillet i browseren: vælg en juvel (gyldige naboer lyser op), fortryd valg,
# ugyldigt byt (forklares roligt, intet blink, koster intet træk), gyldigt byt med fald,
# tip, tastatur, glød fra, temaskift (alle fire farvetemaer), pause, bekræftelsen ved
# Afslut, game over når trækkene er brugt, rekorder og dwell (ét dwell = én handling).
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 juveler/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     JUVELER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri() + '?spil=juveler'
SHOT_DIR = os.environ.get('JUVELER_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
MOBIL = [(390,844),(844,390)]   # her kan 6 × 6 ikke nå 80 px felter (kendt begrænsning)
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
def cell_center(pg, i):
    bb = pg.locator('#board .cell').nth(i).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def click_cell(pg, i):
    x, y = cell_center(pg, i); pg.mouse.click(x, y); pg.wait_for_timeout(40)
def cls(pg, c):
    return pg.evaluate("c => [...document.querySelectorAll('#board .cell')].map((e, i) => e.classList.contains(c) ? i : -1).filter(i => i >= 0)", c)
def wait_idle(pg):
    pg.wait_for_function("!Juveler.busy", timeout=8000); pg.wait_for_timeout(60)
# Et ugyldigt byt: to forskellige naboer, der ikke giver tre på stribe
BAD = """() => { const r = Juveler.run, n = r.n, g = r.state.grid, G = JuvelerGame;
  for (let i = 0; i < n*n; i++) for (const j of G.neighbours(i, n)) if (g[i] !== g[j] && !G.wouldMatch(g, n, i, j)) return [i, j];
  return null; }"""
NO_ANIM = """() => [...document.querySelectorAll('#board .cell, #board .cell *, #hint')].every(e => getComputedStyle(e).animationName === 'none')"""

def gameplay(pg, w, h, tag):
    m = st(pg, "Juveler.run.hint()")
    a, b = m
    # Vælg: juvelen markeres, de gyldige naboer lyser op, resten dæmpes
    click_cell(pg, a)
    tg = st(pg, "Juveler.targets")
    if st(pg, "Juveler.selected") != a or b not in tg: fails.append('%s valg gav %s %s' % (tag, st(pg, "Juveler.selected"), tg))
    if cls(pg, 'valgt') != [a] or sorted(cls(pg, 'maal')) != sorted(tg): fails.append('%s markering valgt=%s mål=%s' % (tag, cls(pg, 'valgt'), cls(pg, 'maal')))
    if not cls(pg, 'daempet'): fails.append(tag + ' de andre juveler blev ikke dæmpet')
    # Samme juvel igen = fortryd
    click_cell(pg, a)
    if st(pg, "Juveler.selected") != -1: fails.append(tag + ' klik på samme juvel fortrød ikke')
    # Fortryd valg-knappen
    click_cell(pg, a); pg.click('#btn-undo'); pg.wait_for_timeout(40)
    if st(pg, "Juveler.selected") != -1: fails.append(tag + ' Fortryd valg virkede ikke')
    # Ugyldigt byt: roligt, uden blink, koster intet
    bad = st(pg, BAD)
    before = st(pg, "[Juveler.run.state.moves, Juveler.run.state.swaps, Juveler.run.state.grid.join('')]")
    click_cell(pg, bad[0]); click_cell(pg, bad[1]); pg.wait_for_timeout(80)
    r = st(pg, "[Juveler.invalid, document.getElementById('hint').className, Juveler.selected]")
    if r[0] != bad or 'warn' not in r[1] or r[2] != bad[0]: fails.append('%s ugyldigt byt gav %s' % (tag, r))
    if sorted(cls(pg, 'ugyldig')) != sorted(bad): fails.append('%s ugyldig-markering %s' % (tag, cls(pg, 'ugyldig')))
    if not st(pg, NO_ANIM): fails.append(tag + ' ugyldigt byt blinker (animation)')
    if st(pg, "[Juveler.run.state.moves, Juveler.run.state.swaps, Juveler.run.state.grid.join('')]") != before: fails.append(tag + ' ugyldigt byt kostede noget')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(40)
    if st(pg, "Juveler.selected") != -1 or not st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc fortrød ikke valget (eller åbnede pause)')
    # Tip: to juveler markeres, intet koster
    pg.click('#btn-tip'); pg.wait_for_timeout(40)
    tp = st(pg, "Juveler.tip")
    if not tp or sorted(cls(pg, 'tip')) != sorted(tp) or st(pg, "Juveler.run.state.moves") != before[0]: fails.append('%s tip gav %s / %s' % (tag, tp, cls(pg, 'tip')))
    # Gyldigt byt med musen: ét træk (plus optjente), point, ingen striber bagefter
    click_cell(pg, tp[0]); click_cell(pg, tp[1])
    pg.wait_for_timeout(120)
    if not st(pg, "Juveler.busy"): fails.append(tag + ' byttet blev ikke animeret')
    wait_idle(pg)
    s = st(pg, "[Juveler.run.state.swaps, Juveler.run.state.score, JuvelerGame.hasRun(Juveler.run.state.grid, Juveler.run.n), Juveler.run.state.moves, Juveler.run.state.earnedTotal, document.getElementById('hud-score').textContent]")
    if s[0] != 1 or s[1] < 30 or s[2] or s[3] != before[0] - 1 + s[4] or s[5] != str(s[1]): fails.append('%s byt gav %s' % (tag, s))
    if cls(pg, 'vaek') or st(pg, "document.querySelectorAll('#board .cell.glid, #board .cell.fra-oven, #board .cell.lander').length"): fails.append(tag + ' bevægelsesklasser blev hængende')
    # Tastatur: pil viser markøren i midten, Enter vælger, pil + Enter bytter eller vælger
    pg.mouse.move(1, 1); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    n = st(pg, "Juveler.run.n"); mid = (n // 2) * n + n // 2
    if st(pg, "Juveler.cursor") != mid: fails.append('%s markøren startede i %s' % (tag, st(pg, "Juveler.cursor")))
    pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); pg.wait_for_timeout(40)
    if st(pg, "Juveler.selected") != mid - n: fails.append('%s Enter valgte %s' % (tag, st(pg, "Juveler.selected")))
    pg.keyboard.press('Delete'); pg.wait_for_timeout(30)
    if st(pg, "Juveler.selected") != -1: fails.append(tag + ' Delete fortrød ikke')
    pg.keyboard.press('t'); pg.wait_for_timeout(30)
    if not st(pg, "Juveler.tip"): fails.append(tag + ' T viste ikke et tip')
    km = st(pg, "Juveler.run.hint()")
    # Gå hen til første juvel i et muligt byt og byt med tastaturet
    def goto(i):
        for _ in range(20):
            c = st(pg, "Juveler.cursor")
            if c == i: return
            cx, cy, ix, iy = c % n, c // n, i % n, i // n
            pg.keyboard.press('ArrowRight' if ix > cx else 'ArrowLeft' if ix < cx else 'ArrowDown' if iy > cy else 'ArrowUp')
    goto(km[0]); pg.keyboard.press('Enter'); goto(km[1]); pg.keyboard.press('Enter'); pg.wait_for_timeout(60)
    wait_idle(pg)
    if st(pg, "Juveler.run.state.swaps") != 2: fails.append(tag + ' byt med tastaturet virkede ikke')

def dwell_check(pg, w, h, tag):
    """Ét dwell = én handling: valget bliver stående, selv om blikket bliver."""
    pg.evaluate("Juveler.start(); Juveler.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(150)
    m = st(pg, "Juveler.run.hint()")
    x, y = cell_center(pg, m[0]); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Juveler.settings.set('dwell', true)")
    try: pg.wait_for_function("Juveler.selected === %d" % m[0], timeout=3000)
    except Exception: fails.append(tag + ' dwell valgte ikke juvelen')
    pg.wait_for_timeout(1600)
    if st(pg, "Juveler.selected") != m[0]: fails.append(tag + ' dwell gentog handlingen (valget blev fortrudt)')
    x, y = cell_center(pg, m[1]); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Juveler.run.state.swaps === 1", timeout=3000)
    except Exception: fails.append(tag + ' dwell på målet byttede ikke')
    wait_idle(pg)
    pg.evaluate("Juveler.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

def shot(pg, name):
    if SHOT: pg.screenshot(path=SHOT + name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        main = (w, h) == (1366, 768)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, main and 'startskaerm.png')
        av = st(pg, "Juveler.availableSizes()")
        cells = st(pg, "['6x6','7x7','8x8'].map(s => Math.round(Juveler.cellSizeFor(s)))")
        print('     %dx%d størrelser %s (felt 6/7/8 = %s px) note: %s' % (w, h, av, cells, st(pg, "document.getElementById('size-note').textContent")))
        if '6x6' not in av: fails.append(tag + ' 6 × 6 mangler')
        shown = st(pg, "[...document.querySelectorAll('#menu [data-mode]')].filter(b => !b.hidden).map(b => b.dataset.mode)")
        if shown != av: fails.append('%s menuen viser %s' % (tag, shown))
        pg.evaluate("Juveler.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', None)
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Juveler.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, None)
        pg.evaluate("Juveler.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h)
        for size in av:
            pg.evaluate("s => { Juveler.gameSettings.set('mode', s); Juveler.start(); }", size); pg.wait_for_timeout(150)
            r = st(pg, "[Juveler.run.state.size, JuvelerGame.hasRun(Juveler.run.state.grid, Juveler.run.n), JuvelerGame.hasMove(Juveler.run.state.grid, Juveler.run.n)]")
            if r != [size, False, True]: fails.append('%s %s bræt forkert %s' % (tag, size, r))
            check(pg,'spil '+size,'#game',w,h)
            c = st(pg, "Math.round(document.querySelector('#board .cell').getBoundingClientRect().width)")
            if c < 80 and (w, h) not in MOBIL: fails.append('%s %s felter kun %s px' % (tag, size, c))
        pg.evaluate("Juveler.gameSettings.set('mode', Juveler.availableSizes().slice(-1)[0]); Juveler.start()"); pg.wait_for_timeout(150)
        gameplay(pg, w, h, tag)
        # Skærmbillede midt i spillet: en juvel valgt, gyldige naboer lyser op
        m = st(pg, "Juveler.run.hint()"); click_cell(pg, m[0]); pg.mouse.move(1, 1); pg.wait_for_timeout(60)
        check(pg,'spil i gang (valgt)','#game',w,h, tag + '.png')
        if main: shot(pg, 'spil-i-gang.png')
        # Glød kan slås fra: ingen lysskær, markeringer kan stadig ses
        pg.evaluate("Juveler.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        g = st(pg, """() => { const t = document.querySelector('#board .cell.maal'), v = document.querySelector('#board .cell.valgt');
            const sh = e => e ? getComputedStyle(e).boxShadow : 'none', filt = e => e ? getComputedStyle(e.querySelector('svg') || e).filter : 'none';
            return [document.documentElement.dataset.jvGloed, getComputedStyle(document.querySelector('#board')).boxShadow, filt(t), !!t, !!v,
                    t ? getComputedStyle(t).outlineStyle + '/' + getComputedStyle(t).borderStyle : '']; }""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] not in ('none', '') or not g[3] or not g[4]: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, (main or (w,h) == (390,844)) and tag + '-uden-gloed.png')
        if main: shot(pg, 'uden-gloed.png')
        pg.evaluate("Juveler.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        # Temaskift: alle fire farvetemaer giver seks forskellige juvelfarver, som kan ses mod brættet
        for th in ['solnedgang', 'cyberpunk', 'kontrast', 'neon']:
            pg.evaluate("t => Juveler.settings.set('theme', t)", th); pg.wait_for_timeout(120)
            cols = st(pg, """() => [...new Set(JuvelerGame.TYPES.map(t => (e => e ? getComputedStyle(e).getPropertyValue('--jv-farve').trim() : null)(document.querySelector('#board .jv[data-type=' + t + ']'))).filter(Boolean))]""")
            types = st(pg, "[...new Set(Juveler.run.state.grid)].length")
            if len(cols) < types: fails.append('%s tema %s: kun %d juvelfarver (%s)' % (tag, th, len(cols), cols))
            if main: shot(pg, 'tema-%s.png' % th)
            if th != 'neon': check(pg, 'tema ' + th, '#game', w, h)
        pg.mouse.move(1, 1); pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        if st(pg, "Juveler.selected") != -1: fails.append(tag + ' Esc fortrød ikke valget')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h)
        pg.click('#btn-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut', None)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if st(pg, "[document.getElementById('confirm-overlay').hidden, Juveler.run.state.ended]") != [True, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        pg.evaluate("Juveler.setPaused(false)"); pg.wait_for_timeout(60)
        # Game over: sidste træk bruges
        # (giver det sidste træk et ekstra træk, prøves igen med ét træk tilbage)
        for _ in range(10):
            pg.evaluate("() => { const r = Juveler.run; r._load(r.state.grid, 1); Juveler.refresh(); }")
            m = st(pg, "Juveler.run.hint()")
            pg.evaluate("m => { Juveler.act(m[0]); Juveler.act(m[1]); }", m)
            wait_idle(pg)
            if st(pg, "Juveler.run.state.over"): break
        if st(pg, "Juveler.run.state.over"):
            try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=4000)
            except Exception: fails.append(tag + ' game over blev ikke vist')
            pts = st(pg, "Juveler.run.state.score")
            mode = st(pg, "Juveler.run.state.size")
            if not st(pg, "Juveler.records.list('%s').some(e => e.score === %d)" % (mode, pts)): fails.append(tag + ' rekorden blev ikke gemt')
            split = st(pg, "!document.getElementById('btn-go-rec').hidden")
            check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag + '-gameover.png')
            if main: shot(pg, 'game-over.png')
            if split:
                pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
                check(pg,'game over (rekorder)','#gameover',w,h)
                pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        else:
            print('     %dx%d sidste træk gav ekstra træk – game over ikke nået' % (w, h))
        dwell_check(pg, w, h, tag)
        # Hallen med Juveler aktiv
        if main:
            pg.goto(HALL); pg.wait_for_timeout(600)
            shot(pg, 'hallen.png')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)
