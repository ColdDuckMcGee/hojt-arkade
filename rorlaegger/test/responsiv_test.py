# Responsiv test af Rørlægger: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px, rørfelterne >= 80 px (vises som felt=..px) og ingen fejl i konsollen.
#
# Desuden spillet i browseren: drej med mus, tryk og tastatur, Fortryd, kilden kan ikke
# drejes, Luk vandet på (forkert koster et liv, rigtigt giver Bane klaret), Næste bane,
# bekræftelsen ved Afslut, game over, rekorder, glød fra, dwell (ét dwell = én drejning)
# og rolig/statisk vand ved prefers-reduced-motion.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 rorlaegger/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     RORLAEGGER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('RORLAEGGER_SKAERMBILLEDER')
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
def name_tag(w, h): return 'responsiv-%dx%d' % (w, h)
def check(pg, name, sel, w, h, shot=None):
    r = pg.evaluate(CHECK, sel)
    small_btn = r['minBtn'] is not None and r['minBtn'] < MIN_BTN
    ok = not r['scroll'] and not r['inner'] and not r['clipped'] and not r['overlap'] and not r['textOut'] and not small_btn
    extra = ''
    if sel == '#game' and r['cellPx'] is not None and r['cellPx'] < 80: ok = False; extra = ' FELTER FOR SMÅ'
    if sel == '#game': extra += ' layout=%s felt=%spx' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['cellPx'])
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + ('' if shot == '%s.png' % name_tag(w, h) else 'ekstra/') + shot)
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

def st(pg, expr): return pg.evaluate(expr)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def cell_center(pg, i):
    bb = pg.locator('#board .cell').nth(i).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def click_cell(pg, i):
    x, y = cell_center(pg, i); pg.mouse.click(x, y); pg.wait_for_timeout(40)
def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))
# Læg en bestemt bane ind (samme frø hver gang)
SET = """([n, lv, seed]) => { const R = Rorlaegger, L = R.logik; R.run.state.level = lv; R.run._setBoard(L.generate(n, lv, seed)); R.refresh(); R.layout(); }"""
# Drejbare felter, der ikke er kilde/afløb
FREE = "Rorlaegger.run.state.board.tiles.map((t,i)=>t.fixed?-1:i).filter(i=>i>=0)"
# Læg banens løsning (uden at bruge drejninger) – til at teste Bane klaret
SOLVE = """() => { const R = Rorlaegger, L = R.logik, s = R.run.state, b = s.board;
  b.tiles.forEach((t, i) => { if (!t.fixed && b.need[i]) t.rot = (t.rot + L.turnsNeeded(t, b.need[i])) % 4; });
  s.flow = L.flow(b); R.refresh(); return s.flow.reached; }"""
def wait_water(pg):
    pg.wait_for_function("!Rorlaegger.flowing", timeout=8000); pg.wait_for_timeout(80)
def gameplay(pg, w, h, tag):
    pg.evaluate("Rorlaegger.start()"); pg.wait_for_timeout(150)
    pg.evaluate(SET, [4, 1, 4242]); pg.wait_for_timeout(100)
    free = st(pg, FREE)
    r0 = st(pg, "[Rorlaegger.run.state.board.tiles[%d].rot, Rorlaegger.run.state.turnsLeft]" % free[0])
    click_cell(pg, free[0])
    r1 = st(pg, "[Rorlaegger.run.state.board.tiles[%d].rot, Rorlaegger.run.state.turnsLeft]" % free[0])
    if r1 != [(r0[0] + 1) % 4, r0[1] - 1]: fails.append('%s klik drejede ikke (%s -> %s)' % (tag, r0, r1))
    ang = pg.evaluate("i => document.querySelectorAll('#board .cell')[i].querySelector('.rl-drej').style.transform", free[0])
    if 'rotate' not in ang: fails.append(tag + ' drejningen tegnes ikke')
    # Fortryd-knappen giver drejningen tilbage
    pg.click('#btn-undo'); pg.wait_for_timeout(40)
    if st(pg, "[Rorlaegger.run.state.board.tiles[%d].rot, Rorlaegger.run.state.turnsLeft]" % free[0]) != r0: fails.append(tag + ' Fortryd virkede ikke')
    # Kilden kan ikke drejes
    src = st(pg, "Rorlaegger.run.state.board.source")
    click_cell(pg, src)
    if 'Kilden' not in st(pg, "document.getElementById('hint').textContent"): fails.append(tag + ' kilden gav ingen besked')
    # Tastatur: piletast viser markøren i midten, Enter drejer, F fortryder
    pg.mouse.move(1, 1); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    if st(pg, "Rorlaegger.cursor") != 10: fails.append('%s markøren startede i %s' % (tag, st(pg, "Rorlaegger.cursor")))
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowUp')
    if st(pg, "Rorlaegger.cursor") != 5: fails.append('%s piletasterne flyttede til %s' % (tag, st(pg, "Rorlaegger.cursor")))
    if 'cur' not in pg.locator('#board .cell').nth(5).get_attribute('class').split(): fails.append(tag + ' markøren tegnes ikke')
    fixed5 = st(pg, "Rorlaegger.run.state.board.tiles[5].fixed")
    tl = st(pg, "Rorlaegger.run.state.turnsLeft")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(40)
    if not fixed5 and st(pg, "Rorlaegger.run.state.turnsLeft") != tl - 1: fails.append(tag + ' Enter drejede ikke')
    pg.keyboard.press('f'); pg.wait_for_timeout(40)
    if st(pg, "Rorlaegger.run.state.turnsLeft") != tl: fails.append(tag + ' F fortrød ikke')
    # To drejninger, så der er noget at se
    click_cell(pg, free[1]); click_cell(pg, free[2])
def water_fail(pg, w, h, tag):
    if st(pg, "Rorlaegger.run.state.flow.reached"): fails.append(tag + ' banen var allerede løst'); return
    lv = st(pg, "Rorlaegger.run.state.lives")
    pg.click('#btn-water'); pg.wait_for_timeout(60)
    if not st(pg, "Rorlaegger.flowing") or not st(pg, "document.getElementById('btn-water').disabled"): fails.append(tag + ' vandet løb ikke (knappen ikke låst)')
    wait_water(pg)
    r = st(pg, "[Rorlaegger.run.state.lives, document.querySelectorAll('#hud-lives .on').length, document.getElementById('hint').className, document.querySelectorAll('#board .cell.vaad').length > 0]")
    if r != [lv - 1, lv - 1, 'hint err', True]: fails.append('%s forkert vand gav %s' % (tag, r))
def dwell_check(pg, w, h, tag):
    """Ét dwell = én drejning, og dwell virker på Fortryd."""
    pg.evaluate("Rorlaegger.start(); Rorlaegger.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(120)
    pg.evaluate(SET, [4, 1, 77]); pg.wait_for_timeout(80)
    free = st(pg, FREE); i = free[0]
    tl = st(pg, "Rorlaegger.run.state.turnsLeft")
    x, y = cell_center(pg, i); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Rorlaegger.settings.set('dwell', true)")
    try: pg.wait_for_function("Rorlaegger.run.state.turnsLeft === %d" % (tl - 1), timeout=3000)
    except Exception: fails.append(tag + ' dwell på et rør drejede ikke')
    pg.wait_for_timeout(1600)
    if st(pg, "Rorlaegger.run.state.turnsLeft") != tl - 1: fails.append(tag + ' dwell gentog drejningen')
    x, y = center(pg, '#btn-undo'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Rorlaegger.run.state.turnsLeft === %d" % tl, timeout=3000)
    except Exception: fails.append(tag + ' dwell på Fortryd virkede ikke')
    pg.evaluate("Rorlaegger.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

def main_shot(name):
    return ('/' + name) if SHOT else None

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
        mx = st(pg, "Rorlaegger.maxN()")
        cells = st(pg, "[4,5,6].map(n => Math.round(Rorlaegger.cellSizeFor(n)))")
        print('     %dx%d største bane %dx%d (felt 4/5/6 = %s px) note: %s' % (w, h, mx, mx, cells, st(pg, "document.getElementById('size-note').textContent")))
        want = 4 if small else 6
        if mx != want: fails.append('%s største bane %s, ventede %s' % (tag, mx, want))
        pg.evaluate("Rorlaegger.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Rorlaegger.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Rorlaegger.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        # Alle størrelser, skærmen kan bære: felterne store nok
        pg.evaluate("Rorlaegger.start()"); pg.wait_for_timeout(150)
        for n in [x for x in [4, 5, 6] if x <= mx]:
            pg.evaluate(SET, [n, 9, 1000 + n]); pg.wait_for_timeout(120)
            check(pg,'spil %dx%d' % (n, n),'#game',w,h, tag + '-spil-%dx%d.png' % (n, n))
        gameplay(pg, w, h, tag)
        water_fail(pg, w, h, tag)
        check(pg,'spil i gang (vand nåede ikke frem)','#game',w,h, tag+'.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
        # Glød kan slås fra: ingen lysskær, spillet ser ens ud i opbygning
        pg.evaluate("Rorlaegger.gameSettings.set('gloed', false)"); pg.wait_for_timeout(400)
        g = pg.evaluate("""() => [document.documentElement.dataset.rlGloed, getComputedStyle(document.querySelector('#board')).boxShadow,
                    getComputedStyle(document.querySelector('#hud-score')).textShadow, getComputedStyle(document.documentElement).getPropertyValue('--rl-vand-glow').trim(),
                    document.querySelectorAll('#rl-ikoner symbol').length]""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] != 'none' or g[3] != 'none' or g[4] < 12: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Rorlaegger.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # Bane klaret: læg løsningen, luk vandet på
        if not pg.evaluate(SOLVE): fails.append(tag + ' løsningen førte ikke vandet frem')
        sc0 = st(pg, "Rorlaegger.run.state.score")
        pg.keyboard.press('v'); wait_water(pg); pg.wait_for_timeout(200)
        if st(pg, "document.getElementById('done-overlay').hidden"): fails.append(tag + ' Bane klaret blev ikke vist')
        s = st(pg, "[Rorlaegger.run.state.cleared, Rorlaegger.run.state.score > %d, document.getElementById('done-points').textContent]" % sc0)
        if s[0] != 1 or not s[1]: fails.append('%s point/klaret forkert %s' % (tag, s))
        check(pg,'bane klaret','#game',w,h, tag+'-klaret.png')
        pts = st(pg, "Rorlaegger.run.state.score")
        pg.click('#btn-done-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (bane klaret)', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if st(pg, "[document.getElementById('confirm-overlay').hidden, document.getElementById('done-overlay').hidden, Rorlaegger.run.state.ended]") != [True, False, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        pg.click('#btn-next'); pg.wait_for_timeout(150)
        if st(pg, "[Rorlaegger.run.state.level, Rorlaegger.run.state.cleared, Rorlaegger.run.state.solved]") != [2, 1, False]: fails.append(tag + ' Næste bane virkede ikke')
        check(pg,'bane 2','#game',w,h)
        # Game over: vandet lukkes på, til livene er brugt
        for k in range(3):
            if not st(pg, "document.getElementById('gameover').hidden"): break
            if st(pg, "Rorlaegger.run.state.flow.reached"): pg.evaluate("Rorlaegger.turn(%s)" % st(pg, FREE + "[0]"))
            pg.evaluate("Rorlaegger.water()"); wait_water(pg)
        try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=4000)
        except Exception: fails.append(tag + ' game over blev ikke vist')
        if not st(pg, "Rorlaegger.records.list('stigende').some(e => e.levels === 1 && e.score === %d)" % pts): fails.append(tag + ' rekorden blev ikke gemt')
        split = st(pg, "!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        ctx.close()
    # Mindre bevægelse: vandet vises med det samme (ingen overgange)
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Rorlaegger.start()"); pg.evaluate(SET, [4, 1, 5]); pg.evaluate(SOLVE)
    t = pg.evaluate("""() => { const c = document.querySelector('#board .cell .rl-drej'); return [document.getElementById('game').classList.contains('calm'), getComputedStyle(c).transitionDuration]; }""")
    pg.evaluate("Rorlaegger.water()"); pg.wait_for_timeout(700)
    done = st(pg, "!document.getElementById('done-overlay').hidden")
    print('%s reduced motion: calm=%s overgang=%s, klaret efter 0,7 s=%s' % ('OK  ' if t[0] and t[1] in ('0s',) and done else 'FEJL', t[0], t[1], done))
    if not (t[0] and t[1] == '0s' and done): fails.append('reduced motion: %s %s' % (t, done))
    ctx.close()
    # Hallen med Rørlægger aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.goto(HALL + '?spil=rorlaegger'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Rørlægger/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Rørlægger' not in rl or hall_errs: fails.append('hallen viser ikke Rørlægger som aktiv: %s %s' % (rl, hall_errs))
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
