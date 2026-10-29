# Responsiv test af Kælderen: alle skærme ved 8 opløsninger, billedrate og spillet i browseren.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden: taster (pile/WASD, mellemrum, M, Esc), knapperne, klik på gulvet = gå derhen,
# auto-gang stopper ved en ny fjende, skud med træf/forbi, klik på kortet, butik og køb,
# game over ved liv 0, rekorder, glød fra og prefers-reduced-motion.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 kaelderen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     KAELDER_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('KAELDER_SKAERMBILLEDER')
SHOT = (SHOT_DIR.rstrip('/') + '/') if SHOT_DIR else None
if SHOT: os.makedirs(SHOT + 'ekstra', exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SIZES = [(1920,1080),(1366,768),(1280,720),(1024,768),(1024,1366),(1366,1024),(390,844),(844,390)]
if os.environ.get('ONLY'): SIZES = [tuple(map(int, s.split('x'))) for s in os.environ['ONLY'].split(',')]
MAIN = (1366, 768)   # størrelsen for de navngivne skærmbilleder
MIN_BTN = 80
HOVED = ['startskaerm.png', 'gang.png', 'kamp.png', 'kort.png', 'butik.png', 'gameover.png']
errs=[]; fails=[]; summary={}; fps={}
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
  const cv = scr.querySelector('#view'); out.board = cv && vis(cv) ? [Math.round(cv.getBoundingClientRect().width), Math.round(cv.getBoundingClientRect().height)] : null;
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
    if sel == '#game': extra += ' layout=%s visning=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['board'])
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-30s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if shot and SHOT: pg.screenshot(path=SHOT + ('' if shot in HOVED or shot.startswith('responsiv-') else 'ekstra/') + shot)
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


def st(pg, expr, *a): return pg.evaluate(expr, *a)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def shot(pg, name):
    if SHOT: pg.screenshot(path=SHOT + name)

# Iscenesæt en kamp: drej mod den længste frie linje, og sæt en kravler og en skytte i den
KAMP = """() => { const K = Kaelderen, s = K.run.state, p = s.spiller, L = K.logik; let best = -1, bd = p.dir;
  for (let d = 0; d < 4; d++) { let n = 0; while (L.gaaelig(L.cell(s, p.x + L.DX[d] * (n + 1), p.y + L.DY[d] * (n + 1)))) n++; if (n > best) { best = n; bd = d; } }
  p.dir = bd; s.fjender = []; s.ting = s.ting.filter(t => t.type === 'noegle');
  const at = k => ({ x: p.x + L.DX[bd] * k, y: p.y + L.DY[bd] * k });
  const a = at(Math.min(2, best)), b = at(Math.min(5, best));
  s.fjender.push({ id: 901, type: 'kravler', x: a.x, y: a.y, px: a.x, py: a.y, hp: 2, max: 2, vaagen: true, sidst: 0 });
  if (best >= 4) s.fjender.push({ id: 902, type: 'skytte', x: b.x, y: b.y, px: b.x, py: b.y, hp: 2, max: 2, vaagen: true, sidst: 0 });
  s.besked = ''; K.refresh(); return best; }"""

def errs_for(tag): return [e for e in errs if e.startswith(tag)]

def screens(pg, w, h, tag):
    main = (w, h) == MAIN
    pg.goto(URL); pg.wait_for_timeout(400)
    check(pg, 'menu', '#menu', w, h, 'startskaerm.png' if main else None)
    pg.click('#btn-settings'); pg.wait_for_timeout(80)
    for t in ['styring', 'udseende', 'grafik', 'lyd']:
        pg.click('#settings [data-tab="%s"]' % t); pg.wait_for_timeout(50)
        pages(pg, '#settings', w, h, 'indstillinger ' + t, ('indstillinger-%s-%s' % (t, tag)) if main else None)
    pg.click('#btn-settings-back'); pg.wait_for_timeout(50)
    pg.click('#btn-om'); pg.wait_for_timeout(50); pages(pg, '#om', w, h, 'om', None); pg.click('#btn-om-back')
    pg.click('#btn-records'); pg.wait_for_timeout(50); check(pg, 'rekorder', '#records', w, h); pg.click('#btn-records-back')
    pg.click('#btn-start'); pg.wait_for_timeout(300)
    pg.evaluate("Kaelderen.start(20261029)"); pg.wait_for_timeout(500)
    check(pg, 'gang', '#game', w, h, 'gang.png' if main else '%s.png' % name_tag(w, h))
    if main: shot(pg, '%s.png' % name_tag(w, h))
    # Billedrate (hvert billede tegnes i 2 sekunder)
    r = pg.evaluate("Kaelderen.maalFps(2000)")
    fps['%dx%d' % (w, h)] = r
    print('     %dx%d billedrate %.1f fps, %.1f ms pr. billede, skala %.2f, intern %dx%d' % (w, h, r['fps'], r['renderMs'], r['skala'], r['intern']['w'], r['intern']['h']))
    if r['fps'] < 30: fails.append('%s billedraten er kun %.1f fps' % (tag, r['fps']))
    pg.evaluate(KAMP); pg.wait_for_timeout(120)
    pg.evaluate("Kaelderen.act('handling')"); pg.wait_for_timeout(250)
    check(pg, 'kamp', '#game', w, h, ('kamp.png' if main else 'kamp-' + tag + '.png'))
    pg.keyboard.press('m'); pg.wait_for_timeout(150)
    if not st(pg, "Kaelderen.kortVist"): fails.append(tag + ' M viste ikke kortet')
    check(pg, 'kort', '#game', w, h, ('kort.png' if main else 'kort-' + tag + '.png'))
    pg.keyboard.press('m'); pg.wait_for_timeout(80)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc viste ikke pause')
    check(pg, 'pause', '#game', w, h)
    pg.click('#btn-quit'); pg.wait_for_timeout(80)
    check(pg, 'bekræft', '#game', w, h)
    pg.click('#btn-confirm-no'); pg.wait_for_timeout(50)
    if pg.is_visible('#btn-resume'): pg.click('#btn-resume'); pg.wait_for_timeout(50)
    # Butik
    pg.evaluate("(() => { const s = Kaelderen.run.state; s.skat = 140; s.skatIalt = 140; s.fase = 'butik'; s.dybde = s.etage + 1; Kaelderen.openButik('Du gik ned ad trappen.'); })()"); pg.wait_for_timeout(150)
    check(pg, 'butik', '#butik', w, h, ('butik.png' if main else 'butik-' + tag + '.png'))
    pg.click('#btn-videre'); pg.wait_for_timeout(250)
    if st(pg, "Kaelderen.run.state.etage") != 2: fails.append(tag + ' Videre gik ikke til etage 2')
    # Game over
    pg.evaluate("(() => { const s = Kaelderen.run.state; s.spiller.hp = 0; s.fase = 'slut'; s.doedAf = 'Kolos'; Kaelderen.finish('doed'); })()"); pg.wait_for_timeout(200)
    check(pg, 'game over', '#gameover', w, h, ('gameover.png' if main else 'gameover-' + tag + '.png'))
    if st(pg, "document.querySelector('#btn-go-rec') && !document.querySelector('#btn-go-rec').closest('[hidden]')"):
        pg.click('#btn-go-rec'); pg.wait_for_timeout(60); check(pg, 'game over rekorder', '#gameover', w, h); pg.click('#btn-go-rec'); pg.wait_for_timeout(40)

def gameplay(pg, w, h, tag):
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Kaelderen.settings.set('animation', false)")
    pg.click('#btn-start'); pg.wait_for_timeout(150)
    pg.evaluate("Kaelderen.start(4242)"); pg.wait_for_timeout(150)
    p0 = st(pg, "(() => { const p = Kaelderen.run.state.spiller; return [p.x, p.y, p.dir]; })()")
    pg.mouse.move(1, 1)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    pg.keyboard.press('a'); pg.wait_for_timeout(40)
    if st(pg, "Kaelderen.run.state.spiller.dir") != p0[2] or st(pg, "Kaelderen.run.state.tur") != 2: fails.append('%s drej med taster: %s' % (tag, st(pg, "[Kaelderen.run.state.spiller.dir, Kaelderen.run.state.tur]")))
    # Knapperne
    for d in range(4):
        if not st(pg, "document.querySelector('[data-act=frem]').disabled"): break
        pg.click('[data-act="drejH"]'); pg.wait_for_timeout(30)
    t0 = st(pg, "Kaelderen.run.state.tur")
    pg.click('[data-act="frem"]'); pg.wait_for_timeout(30)
    if st(pg, "Kaelderen.run.state.tur") != t0 + 1: fails.append(tag + ' Frem-knappen virkede ikke')
    pg.keyboard.press(' '); pg.wait_for_timeout(30)
    # Klik på gulvet = gå derhen (to felter frem, hvis muligt)
    pg.evaluate("Kaelderen.run.state.fjender = []; Kaelderen.setKort(true)"); pg.wait_for_timeout(60)
    tgt = st(pg, """(() => { const s = Kaelderen.run.state, p = s.spiller; let b = null;
       for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { const k = y * s.W + x; if (s.udforsket[k] && Kaelderen.logik.gaaelig(s.cells[k]) && !Kaelderen.logik.fjendeVed(s, x, y)) { const r = Kaelderen.run.rute(x, y); if (r && r.length >= 3 && r.length <= 6 && (!b || r.length > b[2])) b = [x, y, r.length]; } }
       return b; })()""")
    if tgt:
        pt = st(pg, """(t) => { const c = document.getElementById('view').getBoundingClientRect();
          const hit = []; for (let y = 2; y < c.height; y += 2) for (let x = 2; x < c.width; x += 2) { const q = Kaelderen.pick(x, y); if (q && q.kort && q.x === t[0] && q.y === t[1]) hit.push([x, y]); }
          if (!hit.length) return null; const mx = hit.reduce((a, h) => a + h[0], 0) / hit.length, my = hit.reduce((a, h) => a + h[1], 0) / hit.length; return [Math.round(c.left + mx), Math.round(c.top + my)]; }""", tgt)
        if not pt: fails.append(tag + ' fandt ikke feltet på kortet')
        else:
            pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(30)
            try: pg.wait_for_function("(() => { const p = Kaelderen.run.state.spiller; return p.x === %d && p.y === %d && !Kaelderen.auto; })()" % (tgt[0], tgt[1]), timeout=8000)
            except Exception: fails.append('%s klik på kortet gik ikke til %s (står på %s: %s)' % (tag, tgt, st(pg, "[Kaelderen.run.state.spiller.x, Kaelderen.run.state.spiller.y]"), st(pg, "document.getElementById('besked').textContent")))
    pg.evaluate("Kaelderen.setKort(false)"); pg.wait_for_timeout(60)
    # Klik i 3D: et gulvfelt foran går derhen
    pg.evaluate("Kaelderen.run.state.fjender = []; Kaelderen.refresh()")
    for d in range(4):
        if not st(pg, "document.querySelector('[data-act=frem]').disabled"): break
        pg.click('[data-act="drejH"]'); pg.wait_for_timeout(30)
    pt = st(pg, """(() => { const c = document.getElementById('view').getBoundingClientRect(), p = Kaelderen.run.state.spiller;
      for (let y = c.height - 4; y > c.height / 2; y -= 3) { const q = Kaelderen.pick(c.width / 2, y); if (q && (q.type === 'felt' || q.type === 'ting') && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1) return [Math.round(c.left + c.width / 2), Math.round(c.top + y - 6), q.x, q.y]; } return null; })()""")
    if not pt: fails.append(tag + ' fandt ikke gulvfeltet foran i 3D')
    else:
        pg.mouse.click(pt[0], pt[1])
        try: pg.wait_for_function("(() => { const p = Kaelderen.run.state.spiller; return p.x === %d && p.y === %d; })()" % (pt[2], pt[3]), timeout=4000)
        except Exception: fails.append(tag + ' klik på gulvet i 3D gik ikke derhen')
    # Auto-gang stopper, når en fjende dukker op
    pg.evaluate("Kaelderen.start(4242)"); pg.wait_for_timeout(100)
    r = st(pg, """(() => { const K = Kaelderen, s = K.run.state, L = K.logik; s.udforsket.fill(1);
      let far = null; for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { const r = K.run.rute(x, y); if (r && r.length >= 10 && (!far || r.length > far.length)) far = r; }
      if (!far) return 'ingen rute'; s.fjender = [];
      const m = far[far.length - 1], f = far[Math.min(6, far.length - 2)];
      s.fjender.push({ id: 950, type: 'kravler', x: f.x, y: f.y, px: f.x, py: f.y, hp: 2, max: 2, vaagen: false, sidst: 0 });
      K.vaelg({ type: 'felt', x: m.x, y: m.y, kort: true }); return 'ok'; })()""")
    if r != 'ok': fails.append(tag + ' auto-gang: ' + r)
    else:
        pg.wait_for_timeout(3500)
        a = st(pg, "[!!Kaelderen.auto, Kaelderen.run.state.tur, document.getElementById('besked').textContent]")
        if a[0] or a[1] >= 30: fails.append('%s auto-gang stoppede ikke ved fjenden: %s' % (tag, a))
    # Game over ved liv 0 (rigtig død)
    pg.evaluate("Kaelderen.start(99)"); pg.wait_for_timeout(100)
    pg.evaluate(KAMP); pg.evaluate("Kaelderen.run.state.spiller.hp = 1; Kaelderen.run.state.fjender.forEach(f => { f.type = 'kolos'; f.hp = 6; f.max = 6; })"); pg.wait_for_timeout(50)
    # Træd hen til kravleren
    for i in range(4):
        if st(pg, "Kaelderen.run.state.fase") != 'spil': break
        pg.evaluate("Kaelderen.act('vent')"); pg.wait_for_timeout(60)
    try: pg.wait_for_function("document.getElementById('gameover') && !document.getElementById('gameover').hidden", timeout=5000)
    except Exception: fails.append(tag + ' game over kom ikke ved liv 0 (%s)' % st(pg, "[Kaelderen.run.state.fase, Kaelderen.run.state.spiller.hp]"))
    # Glød fra + reduced motion: ingen fejl
    pg.evaluate("Kaelderen.gameSettings.set('gloed', false)"); pg.evaluate("Kaelderen.start(5)"); pg.wait_for_timeout(200)
    check(pg, 'gang uden glød', '#game', w, h, 'gang-uden-gloed.png' if SHOT else None)
    pg.evaluate("Kaelderen.gameSettings.set('gloed', true); Kaelderen.settings.set('animation', true)")
    print('OK   %dx%d spillet' % (w, h) if not [f for f in fails if f.startswith(tag)] else 'FEJL %dx%d spillet' % (w, h))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    for (w, h) in SIZES:
        tag = '%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        pg = ctx.new_page()
        pg.on('console', lambda m, tag=tag: (m.type in ('error', 'warning')) and errs.append('%s %s: %s' % (tag, m.type, m.text)))
        pg.on('pageerror', lambda e, tag=tag: errs.append('%s pageerror: %s' % (tag, e)))
        screens(pg, w, h, tag)
        if (w, h) in [MAIN, (390, 844), (844, 390)]: gameplay(pg, w, h, tag)
        ctx.close()
    # Reduced motion
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce'); pg = ctx.new_page()
    pg.on('console', lambda m: (m.type in ('error', 'warning')) and errs.append('reduced %s: %s' % (m.type, m.text)))
    pg.on('pageerror', lambda e: errs.append('reduced pageerror: %s' % e))
    pg.goto(URL); pg.wait_for_timeout(200); pg.click('#btn-start'); pg.wait_for_timeout(100)
    pg.evaluate("Kaelderen.start(7)")
    for d in range(4):
        if not st(pg, "document.querySelector('[data-act=frem]').disabled"): break
        pg.click('[data-act="drejH"]')
    pg.click('[data-act="frem"]'); pg.wait_for_timeout(16)
    if st(pg, "Kaelderen.tegn.aktiv(performance.now())"): fails.append('reduced motion: kameraet glider stadig')
    ctx.close()
    # Hallen med Kælderen aktiv
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('hallen pageerror: %s' % e))
    pg.goto(HALL + '?spil=kaelderen'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Kælderen/.test(t))""")
    print('%s hallen: %s' % ('OK  ' if 'Spil Kælderen' in rl else 'FEJL', rl))
    if 'Spil Kælderen' not in rl: fails.append('hallen viser ikke Kælderen som aktiv: %s' % rl)
    if SHOT: pg.screenshot(path=SHOT + 'hallen.png')
    ctx.close()
    b.close()

print()
print('Billedrate: ' + ', '.join('%s %.0f fps' % (k, v['fps']) for k, v in fps.items()))
for e in errs: print('KONSOL ' + e)
if fails or errs:
    print('\n%d fejl' % (len(fails) + len(errs)))
    for f in fails: print('  ' + f)
    sys.exit(1)
print('Alt OK')
