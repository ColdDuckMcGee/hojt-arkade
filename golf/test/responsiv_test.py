# Responsiv test af Golf: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden spillet i browseren: drej med knapper og tastatur, kraft, klik på banen for
# at sigte, Slå (bolden ruller og knapperne er låst imens), I hul! med point og slag
# til puljen, vand = strafslag, Næste hul, bekræftelsen ved Afslut, game over når
# puljen er tom, rekorder (pr. forhåndslinje), glød fra, dwell (ét dwell på Slå = ét
# slag; drejeknapperne gentager) og straks slutposition ved prefers-reduced-motion.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 golf/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     GOLF_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('GOLF_SKAERMBILLEDER')
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
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.turn && ('drej' + e.dataset.turn) || e.dataset.power && ('kraft' + e.dataset.power) || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra += ' layout=%s bane=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['board'])
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

# Et enkelt testhul: lige bane fra tee til hul (valgfrit med vand imellem).
# Returnerer en kraft, der går i hul, og sætter retningen mod hullet.
SET = """([water, seedLevel]) => { const G = Golf, L = G.logik, s = G.run.state;
  let h;
  if (seedLevel) h = L.generate(seedLevel, 4242);
  else h = { W: L.W, H: L.H, level: s.level, seed: 1, tee: {x: 150, y: 300}, hul: {x: 850, y: 300}, par: 3, legs: 1, expert: 2,
             vaegge: L.borders().concat([{ax: 500, ay: 0, bx: 500, by: 150, t: 18}]), sand: [], skraaning: [],
             vand: water ? [{x: 420, y: 250, w: 160, h: 100}] : [] };
  G.run._setHole(h); G.run.setAim(0); G.refresh(); G.layout();
  for (let p = 1; p <= L.RULES.powers; p++) if (L.simulate(h, h.tee, 0, p).result === 'hul') return p;
  return -1; }"""
def wait_roll(pg):
    pg.wait_for_function("!Golf.rolling", timeout=15000); pg.wait_for_timeout(80)
def set_power(pg, p):
    for _ in range(12):
        cur = st(pg, "Golf.run.state.power")
        if cur == p: return
        pg.keyboard.press('ArrowUp' if cur < p else 'ArrowDown')
def gameplay(pg, w, h, tag):
    pg.evaluate("Golf.start(12345)"); pg.wait_for_timeout(150)
    pg.mouse.move(1, 1)
    a0 = st(pg, "Golf.run.state.aim")
    pg.click('#controls [data-turn="10"]'); pg.click('#controls [data-turn="-1"]')
    if st(pg, "Golf.run.state.aim") != (a0 + 9) % 360: fails.append('%s drejeknapper gav %s (fra %s)' % (tag, st(pg, "Golf.run.state.aim"), a0))
    pg.mouse.move(1, 1)
    pg.keyboard.press('Shift+ArrowLeft'); pg.keyboard.press('ArrowRight')
    if st(pg, "Golf.run.state.aim") != a0: fails.append('%s piletaster drejede forkert (%s)' % (tag, st(pg, "Golf.run.state.aim")))
    p0 = st(pg, "Golf.run.state.power")
    pg.click('#controls [data-power="1"]')
    if st(pg, "[Golf.run.state.power, document.querySelectorAll('#pow-meter i.on').length]") != [p0 + 1, p0 + 1]: fails.append(tag + ' kraft + virkede ikke')
    pg.keyboard.press('ArrowDown')
    # Klik på banen sigter dertil: hullet → retningen peger mod hullet
    hx = st(pg, "(() => { const s = Golf.run.state, t = Golf.tegn, c = document.getElementById('course').getBoundingClientRect(); for (let y = 0; y < c.height; y += 1) for (let x = 0; x < c.width; x += 1) { const p = t.toWorld(x, y); if (Math.hypot(p.x - s.hole.hul.x, p.y - s.hole.hul.y) < 6) return [c.left + x, c.top + y]; } return null; })()")
    want = st(pg, "Math.round(Golf.logik.angleTo(Golf.run.state.ball, Golf.run.state.hole.hul))")
    pg.evaluate("Golf.run.setAim(0)")
    pg.mouse.click(hx[0], hx[1]); pg.wait_for_timeout(40)
    got = st(pg, "Golf.run.state.aim")
    if min(abs(got - want), 360 - abs(got - want)) > 2: fails.append('%s klik på banen sigtede %s, ventede %s' % (tag, got, want))
    # Et almindeligt slag: knapperne låses, mens bolden ruller
    power = pg.evaluate(SET, [False, 0])
    if power < 0: fails.append(tag + ' testhullet kan ikke gå i hul'); return
    set_power(pg, max(1, power - 3))
    pool = st(pg, "Golf.run.state.pool")
    pg.click('#btn-strike'); pg.wait_for_timeout(60)
    if not st(pg, "Golf.rolling && document.getElementById('btn-strike').disabled"): fails.append(tag + ' Slå låste ikke knapperne')
    wait_roll(pg)
    r = st(pg, "[Golf.run.state.strokes, Golf.run.state.pool, Golf.run.state.holed, document.getElementById('hud-strokes').textContent]")
    if r != [1, pool - 1, False, '1']: fails.append('%s første slag gav %s' % (tag, r))
    check(pg, 'spil i gang (efter et slag)', '#game', w, h)
def water_check(pg, w, h, tag):
    power = pg.evaluate(SET, [True, 0])
    s0 = st(pg, "[Golf.run.state.strokes, Golf.run.state.pool]")
    pg.mouse.move(1, 1); set_power(pg, 10); pg.evaluate("Golf.run.setAim(0); Golf.refresh()")
    res = st(pg, "Golf.logik.simulate(Golf.run.state.hole, Golf.run.state.ball, 0, 10).result")
    if res != 'vand': fails.append(tag + ' testslaget ramte ikke vandet (%s)' % res); return
    pg.keyboard.press('Enter'); wait_roll(pg)
    r = st(pg, "[Golf.run.state.strokes, Golf.run.state.pool, Golf.run.state.penalties, Golf.run.state.ball.x, document.getElementById('hint').className]")
    if r != [s0[0] + 2, s0[1] - 2, 1, 150, 'hint vand']: fails.append('%s vand gav %s' % (tag, r))
def dwell_check(pg, w, h, tag):
    """Ét dwell på Slå = ét slag. Drejeknappen gentager."""
    pg.evaluate("Golf.start(777); Golf.settings.set('dwellTime', 0.5); Golf.gameSettings.set('forhaand', 'kort')"); pg.wait_for_timeout(120)
    pg.evaluate(SET, [False, 0]); pg.evaluate("Golf.run.setPower(2); Golf.refresh()")
    x, y = center(pg, '#btn-strike'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Golf.settings.set('dwell', true)")
    try: pg.wait_for_function("Golf.run.state.strokes === 1", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Slå slog ikke')
    wait_roll(pg); pg.wait_for_timeout(1400)
    if st(pg, "Golf.run.state.strokes") != 1: fails.append(tag + ' dwell på Slå slog igen uden at blikket flyttede sig')
    a0 = st(pg, "Golf.run.state.aim")
    x, y = center(pg, '#controls [data-turn="1"]'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Golf.run.state.aim === %d" % ((a0 + 2) % 360), timeout=4000)
    except Exception: fails.append(tag + ' dwell på drej gentog ikke (%s)' % st(pg, "Golf.run.state.aim"))
    pg.evaluate("Golf.settings.set('dwell', false)"); pg.mouse.move(1, 1)
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
        pg.evaluate("Golf.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Golf.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Golf.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        # Genererede huller på flere niveauer
        pg.evaluate("Golf.start(2026)"); pg.wait_for_timeout(150)
        for lv in [1, 4, 8]:
            pg.evaluate(SET, [False, lv]); pg.wait_for_timeout(100)
            check(pg,'spil hul niveau %d' % lv,'#game',w,h, tag + '-hul%d.png' % lv)
        gameplay(pg, w, h, tag)
        water_check(pg, w, h, tag)
        # Skærmbillede: et genereret hul midt i spillet med forhåndslinje og spor
        pg.evaluate("Golf.start(31); Golf.run.setPower(6); Golf.refresh()"); pg.wait_for_timeout(150)
        pg.keyboard.press('Enter'); wait_roll(pg)
        pg.keyboard.press('Shift+ArrowLeft'); pg.wait_for_timeout(60)
        check(pg,'spil i gang','#game',w,h, tag+'.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
        # Glød kan slås fra: ingen lysskær, spillet ser ens ud i opbygning
        pg.evaluate("Golf.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => [document.documentElement.dataset.golfGloed, getComputedStyle(document.querySelector('#course')).boxShadow,
                    getComputedStyle(document.documentElement).getPropertyValue('--golf-score-glow').trim(), getComputedStyle(document.documentElement).getPropertyValue('--golf-gloed').trim(),
                    document.querySelectorAll('#golf-ikoner symbol').length]""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] != 'none' or g[3] != '0' or g[4] < 9: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Golf.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        if st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc gav ikke pause')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # I hul!
        power = pg.evaluate(SET, [False, 0]); set_power(pg, power)
        sc0 = st(pg, "Golf.run.state.score"); pool = st(pg, "Golf.run.state.pool")
        pg.keyboard.press('Enter'); wait_roll(pg); pg.wait_for_timeout(150)
        if st(pg, "document.getElementById('done-overlay').hidden"): fails.append(tag + ' I hul! blev ikke vist')
        s = st(pg, "[Golf.run.state.cleared, Golf.run.state.score > %d, Golf.run.state.reserve, document.getElementById('done-title').textContent]" % sc0)
        if s[0] != 1 or not s[1] or s[2] != min(9, pool - 1 + 1) or s[3] != 'Hole-in-one!': fails.append('%s I hul gav %s (puljen før %s)' % (tag, s, pool))
        check(pg,'i hul','#game',w,h, tag+'-i-hul.png')
        pts = st(pg, "Golf.run.state.score")
        pg.click('#btn-done-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut (i hul)', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if st(pg, "[document.getElementById('confirm-overlay').hidden, document.getElementById('done-overlay').hidden, Golf.run.state.ended]") != [True, False, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        lv0 = st(pg, "Golf.run.state.level")
        pg.click('#btn-next'); pg.wait_for_timeout(150)
        if st(pg, "[Golf.run.state.level, Golf.run.state.cleared, Golf.run.state.holed, Golf.run.state.strokes]") != [lv0 + 1, 1, False, 0]: fails.append(tag + ' Næste hul virkede ikke')
        check(pg,'hul 2','#game',w,h)
        # Game over: sidste slag i puljen går ikke i hul
        pg.evaluate("Golf.run.state.pool = 1; Golf.run.setPower(1); Golf.refresh()")
        pg.keyboard.press('Enter'); wait_roll(pg)
        try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=5000)
        except Exception: fails.append(tag + ' game over blev ikke vist')
        if not st(pg, "Golf.records.list('kort').some(e => e.holes === 1 && e.score === %d)" % pts): fails.append(tag + ' rekorden blev ikke gemt')
        split = st(pg, "!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        # Hovedbilledet for opløsningen: spillet i gang
        pg.evaluate("Golf.start(31); Golf.run.setPower(6); Golf.refresh()"); pg.wait_for_timeout(150)
        if SHOT: pg.screenshot(path=SHOT + tag + '.png')
        ctx.close()
    # Mindre bevægelse: bolden står straks ved slutpositionen
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Golf.start(9)"); power = pg.evaluate(SET, [False, 0]); pg.evaluate("Golf.run.setPower(%d); Golf.refresh()" % power)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    t = st(pg, "[document.getElementById('game').classList.contains('calm'), Golf.tegn.animating, !document.getElementById('done-overlay').hidden]")
    print('%s reduced motion: calm=%s animerer=%s, i hul efter 0,4 s=%s' % ('OK  ' if t == [True, False, True] else 'FEJL', t[0], t[1], t[2]))
    if t != [True, False, True]: fails.append('reduced motion: %s' % t)
    ctx.close()
    # Hallen med Golf aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.goto(HALL + '?spil=golf'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Golf/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Golf' not in rl or hall_errs: fails.append('hallen viser ikke Golf som aktiv: %s %s' % (rl, hall_errs))
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
