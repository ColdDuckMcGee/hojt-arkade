# Responsiv test af Muren: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden spillet i browseren: drej med knapper (10° og 2°) og tastatur, klik på
# brættet for at sigte, Skyd (drejeknapperne er låst, mens salven flyver), Spring
# frem, muren rykker ned, næste skud fra hvor første kugle landede, bekræftelsen
# ved Afslut, game over når muren når bundlinjen, rekorder, glød fra, dwell (ét
# dwell på Skyd = én salve; drejeknapperne gentager) og straks-afvikling ved
# prefers-reduced-motion.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 muren/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     MUREN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('MUREN_SKAERMBILLEDER')
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
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis).filter(e => true);
  const cv = scr.querySelector('#course'); out.board = cv && vis(cv) ? [Math.round(cv.getBoundingClientRect().width), Math.round(cv.getBoundingClientRect().height)] : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.turn && ('drej' + e.dataset.turn) || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra += ' layout=%s bræt=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['board'])
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
def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))

# Fyld muren tæt ned mod bundlinjen (til game over-test og skærmbilleder)
FILL = """(rows) => { const s = Muren.run.state; for (let r = 1; r <= rows; r++) for (let c = 0; c < 7; c += 2) s.bricks.push({c: c, r: r, n: 3 + r}); Muren.refresh(); }"""
def wait_volley(pg):
    pg.wait_for_function("!Muren.flying", timeout=30000); pg.wait_for_timeout(60)
def gameplay(pg, w, h, tag):
    pg.evaluate("Muren.start(12345); Muren.gameSettings.set('fart', 'hurtig')"); pg.wait_for_timeout(150)
    pg.mouse.move(1, 1)
    pg.click('#controls [data-turn="10"]'); pg.click('#controls [data-turn="-2"]')
    if st(pg, "Muren.run.state.aim") != 8: fails.append('%s drejeknapper gav %s' % (tag, st(pg, "Muren.run.state.aim")))
    pg.mouse.move(1, 1)
    pg.keyboard.press('Shift+ArrowLeft'); pg.keyboard.press('ArrowLeft')
    if st(pg, "Muren.run.state.aim") != -4: fails.append('%s piletaster drejede forkert (%s)' % (tag, st(pg, "Muren.run.state.aim")))
    if st(pg, "document.getElementById('dir-value').textContent") != '-4°': fails.append(tag + ' vinklen vises forkert')
    # Klik på brættet sigter dertil: et punkt lige over kanonen → 0°
    pt = st(pg, "(() => { const s = Muren.run.state, t = Muren.tegn, c = document.getElementById('course').getBoundingClientRect(); for (let y = 0; y < c.height; y++) { const p = t.toWorld(c.width / 2, y); if (p.y > 200) { const q = t.toWorld(0, y); const k = (s.originX - q.x) / (p.x - q.x) * (c.width / 2); return [c.left + k, c.top + y]; } } return null; })()")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(40)
    if abs(st(pg, "Muren.run.state.aim")) > 1: fails.append('%s klik på brættet sigtede %s, ventede 0' % (tag, st(pg, "Muren.run.state.aim")))
    # Skyd: drejeknapper og Skyd er låst, Spring frem er aktiv
    pg.evaluate("Muren.run.setAim(30); Muren.refresh()")
    pg.evaluate("window._gamle = Muren.run.state.bricks.slice()")
    pg.click('#btn-fire'); pg.wait_for_timeout(30)
    r = st(pg, "[Muren.flying, document.getElementById('btn-fire').disabled, document.querySelector('[data-turn=\"2\"]').disabled, document.getElementById('btn-skip').disabled]")
    if r != [True, True, True, False]: fails.append('%s under salven: %s' % (tag, r))
    wait_volley(pg)
    # Muren er rykket ét trin ned (de gamle sten står i række 1), og en ny række er kommet ind øverst
    s = st(pg, "(() => { const st = Muren.run.state, old = _gamle.filter(b => st.bricks.includes(b)); return [st.turn, old.every(b => b.r === 1) && st.bricks.some(b => b.r === 0 && !_gamle.includes(b)), st.originX === st.lastVolley.firstX]; })()")
    if s != [2, True, True]: fails.append('%s efter salven: %s' % (tag, s))
    # Spring frem midt i en salve
    pg.evaluate("Muren.gameSettings.set('fart', 'rolig')")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(50)
    if not st(pg, "Muren.flying"): fails.append(tag + ' Enter skød ikke')
    pg.click('#btn-skip'); pg.wait_for_timeout(40)
    if st(pg, "[Muren.flying, Muren.run.state.turn]") != [False, 3]: fails.append('%s Spring frem: %s' % (tag, st(pg, "[Muren.flying, Muren.run.state.turn]")))
    pg.evaluate("Muren.gameSettings.set('fart', 'normal')")
def dwell_check(pg, w, h, tag):
    """Ét dwell på Skyd = én salve. Drejeknappen gentager."""
    pg.evaluate("Muren.start(777); Muren.settings.set('dwellTime', 0.5); Muren.gameSettings.set('fart', 'hurtig')"); pg.wait_for_timeout(120)
    x, y = center(pg, '#btn-fire'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Muren.settings.set('dwell', true)")
    try: pg.wait_for_function("Muren.run.state.turn === 2", timeout=8000)
    except Exception: fails.append(tag + ' dwell på Skyd skød ikke')
    pg.wait_for_timeout(1400)
    if st(pg, "Muren.run.state.turn") != 2 or st(pg, "Muren.flying"): fails.append(tag + ' dwell på Skyd skød igen uden at blikket flyttede sig')
    a0 = st(pg, "Muren.run.state.aim")
    x, y = center(pg, '#controls [data-turn="2"]'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Muren.run.state.aim === %d" % (a0 + 4), timeout=4000)
    except Exception: fails.append(tag + ' dwell på drej gentog ikke (%s)' % st(pg, "Muren.run.state.aim"))
    pg.evaluate("Muren.settings.set('dwell', false); Muren.gameSettings.set('fart', 'normal')"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))
def mid_game(pg):
    """Et spil i gang til skærmbilleder: nogle ture spillet med faste vinkler."""
    pg.evaluate("""() => { Muren.start(31); const r = Muren.run; [-20, 25, -35, 10, 40, -8, 30].forEach(a => { r.setAim(a); r.fire(); r.finish(); }); r.setAim(-18); Muren.refresh(); }""")
    pg.wait_for_timeout(120)

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
        pg.evaluate("Muren.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Muren.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Muren.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        pg.evaluate("Muren.start(2026)"); pg.wait_for_timeout(150)
        check(pg,'spil tur 1','#game',w,h, tag+'-tur1.png')
        gameplay(pg, w, h, tag)
        mid_game(pg)
        check(pg,'spil i gang','#game',w,h, tag+'.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
        # Midt i en salve (kuglerne i luften)
        pg.evaluate("Muren.gameSettings.set('fart', 'rolig')"); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
        check(pg,'salve i luften','#game',w,h, tag+'-salve.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'salve.png')
        pg.click('#btn-skip'); pg.evaluate("Muren.gameSettings.set('fart', 'normal')"); pg.wait_for_timeout(60)
        # Glød kan slås fra: ingen lysskær, spillet ser ens ud i opbygning
        pg.evaluate("Muren.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        gl = pg.evaluate("""() => [document.documentElement.dataset.murenGloed, getComputedStyle(document.querySelector('#course')).boxShadow,
                    getComputedStyle(document.documentElement).getPropertyValue('--muren-score-glow').trim(), getComputedStyle(document.documentElement).getPropertyValue('--muren-gloed').trim(),
                    document.querySelectorAll('#muren-ikoner symbol').length]""")
        if gl[0] != 'fra' or gl[1] != 'none' or gl[2] != 'none' or gl[3] != '0' or gl[4] < 9: fails.append('%s glød fra gav %s' % (tag, gl))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Muren.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        if st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc gav ikke pause')
        pg.click('#btn-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if st(pg, "[document.getElementById('confirm-overlay').hidden, Muren.run.state.ended]") != [True, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        # Game over: muren fyldes til lige over bundlinjen, og næste salve rykker den ned
        pg.evaluate(FILL, 8)
        pts0 = st(pg, "Muren.run.state.score")
        pg.evaluate("Muren.run.setAim(0); Muren.refresh()")
        check(pg,'fare','#game',w,h, tag+'-fare.png')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(40); pg.click('#btn-skip')
        try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=5000)
        except Exception: fails.append(tag + ' game over blev ikke vist')
        if not st(pg, "Muren.records.list('muren').some(e => e.score === Muren.run.state.score && e.turns === Muren.run.state.turn)"): fails.append(tag + ' rekorden blev ikke gemt')
        split = st(pg, "!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        # Hovedbilledet for opløsningen: spillet i gang
        mid_game(pg)
        if SHOT: pg.screenshot(path=SHOT + tag + '.png')
        ctx.close()
    # Mindre bevægelse: salven er færdig med det samme
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Muren.start(9); Muren.run.setAim(20); Muren.refresh()")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(50)
    t = st(pg, "[document.getElementById('game').classList.contains('calm'), Muren.flying, Muren.run.state.turn]")
    print('%s reduced motion: calm=%s flyver=%s, tur efter skud=%s' % ('OK  ' if t == [True, False, 2] else 'FEJL', t[0], t[1], t[2]))
    if t != [True, False, 2]: fails.append('reduced motion: %s' % t)
    ctx.close()
    # Hallen med Muren aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.goto(HALL + '?spil=muren'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Muren/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Muren' not in rl or hall_errs: fails.append('hallen viser ikke Muren som aktiv: %s %s' % (rl, hall_errs))
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
