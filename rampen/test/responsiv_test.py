# Responsiv test af Rampen: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden spillet i browseren: vinkel og kraft med knapper og tastatur, Send afsted,
# beslutningspunktet "Boost nu?" (spillet står stille, indtil der er valgt), næse
# op/ned med vinger (og at op lander hårdere), Vent/Boost med tastatur, egne lyde, turens resultat og rekord, værkstedet
# (køb), Ny bil med bekræftelse, pause, glød fra, dwell (ét dwell på Send afsted =
# én tur) og straks slutresultat ved prefers-reduced-motion. Til sidst hallen.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 rampen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     RAMPEN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('RAMPEN_SKAERMBILLEDER')
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
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.ang && ('vinkel' + e.dataset.ang) || e.dataset.pow && ('kraft' + e.dataset.pow) || e.dataset.nose && ('naese-' + e.dataset.nose) || e.dataset.upg || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
def idle(pg):
    pg.wait_for_function("!Rampen.playing", timeout=20000); pg.wait_for_timeout(60)

# Et fremskridt med vinger, raket og mønter (så der er noget at vælge og købe)
RIG = """() => { const L = Rampen.logik, p = L.newProgress(1);
  p.coins = 400; p.trips = 3; p.best = 180; p.carScore = 400;
  Object.assign(p.upg, {motor: 3, daek: 2, karrosseri: 2, aero: 2, vinger: 1, raket: 1, braendstof: 1});
  Rampen.setProgress(p); }"""

def gameplay(pg, w, h, tag, shots):
    pg.evaluate(RIG)
    pg.evaluate("Rampen.settings.set('animation', false)")
    pg.evaluate("Rampen.start()"); pg.wait_for_timeout(120); pg.mouse.move(1, 1)
    if st(pg, "Rampen.phase") != 'launch': fails.append(tag + ' turen starter ikke i launch'); return
    a0 = st(pg, "Rampen.game.p.angle")
    pg.click('#controls [data-ang="5"]'); pg.click('#controls [data-ang="-1"]')
    if st(pg, "Rampen.game.p.angle") != a0 + 4: fails.append('%s vinkelknapper gav %s (fra %s)' % (tag, st(pg, "Rampen.game.p.angle"), a0))
    pg.mouse.move(1, 1)
    pg.keyboard.press('Shift+ArrowDown'); pg.keyboard.press('ArrowUp')
    if st(pg, "Rampen.game.p.angle") != a0: fails.append('%s piletaster gav vinkel %s' % (tag, st(pg, "Rampen.game.p.angle")))
    pg.keyboard.press('ArrowLeft')
    if st(pg, "Rampen.game.p.power") != 9: fails.append('%s venstre pil gav kraft %s' % (tag, st(pg, "Rampen.game.p.power")))
    pg.click('#controls [data-pow="1"]')
    if st(pg, "[Rampen.game.p.power, document.querySelectorAll('#pow-meter i.on').length]") != [10, 10]: fails.append(tag + ' kraft + virkede ikke')
    pg.evaluate("Rampen.game.setAngle(40); Rampen.refresh()")
    check(pg, 'opsendelse', '#game', w, h, tag + '-opsendelse.png')
    pg.click('#btn-launch'); idle(pg)
    if st(pg, "Rampen.phase") != 'freeze': fails.append('%s intet beslutningspunkt (fase %s)' % (tag, st(pg, "Rampen.phase"))); return
    # Spillet står stille, til der vælges
    x0 = st(pg, "Rampen.game.flight.x"); pg.wait_for_timeout(500)
    if st(pg, "Rampen.game.flight.x") != x0: fails.append(tag + ' bilen flyttede sig under beslutningspunktet')
    o = st(pg, "[Rampen.options.uden.x, Rampen.options.med && Rampen.options.med.x, /Vent/.test(document.getElementById('hint').textContent)]")
    if not o[1] or o[1] <= o[0]: fails.append('%s forhåndslinjer %s' % (tag, o))
    # Næse op/ned flytter Vent-landingen
    pg.click('#controls [data-nose="op"]'); up = st(pg, "Rampen.options.uden.x")
    pg.click('#controls [data-nose="ned"]'); dn = st(pg, "Rampen.options.uden.x")
    if not up > dn: fails.append('%s næse op/ned ændrede ikke landingen (%s / %s)' % (tag, up, dn))
    if 'hårdere landing' not in st(pg, "document.getElementById('hint').textContent"): fails.append(tag + ' ulempen ved næse op forklares ikke')
    pg.mouse.move(1, 1); pg.keyboard.press('ArrowUp'); pg.keyboard.press('ArrowUp')
    if st(pg, "Rampen.game.flight.nose") != 'op': fails.append(tag + ' pil op satte ikke næsen op')
    check(pg, 'beslutningspunkt', '#game', w, h, tag + '-beslutning.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'beslutningspunkt.png')
    b0 = st(pg, "Rampen.game.flight.boosts")
    pg.keyboard.press('j'); idle(pg)
    used = st(pg, "Rampen.game.flight ? Rampen.game.flight.boostsUsed : Rampen.game.lastResult.boostsUsed")
    if used != 1: fails.append('%s J gav ikke boost (%s brugt, %s før)' % (tag, used, b0))
    k = 0
    while st(pg, "Rampen.phase") == 'freeze' and k < 40:
        top = st(pg, "[Rampen.game.flight.vy <= 0, Rampen.game.flight.y >= 3]")
        if top != [True, True]: fails.append('%s beslutningspunkt uden for toppen af et hop (%s)' % (tag, top))
        pg.keyboard.press('v'); idle(pg); k += 1
    if st(pg, "Rampen.phase") != 'done' or st(pg, "document.getElementById('result-overlay').hidden"): fails.append(tag + ' turens resultat blev ikke vist'); return
    d = st(pg, "Rampen.game.lastResult.dist")
    hd = st(pg, "parseInt(document.getElementById('hud-dist').textContent.replace(/\\D/g, ''), 10)")
    if hd != d: fails.append('%s afstanden i statuslinjen (%s) passer ikke med resultatet (%s)' % (tag, hd, d))
    if not st(pg, "Rampen.records.list('tur').some(e => e.score === %d)" % d): fails.append(tag + ' rekorden blev ikke gemt')
    saved = st(pg, "JSON.parse(localStorage.getItem('hojtArkade.rampen.fremskridt')).trips")
    if saved != 4: fails.append('%s fremskridtet blev ikke gemt (%s ture)' % (tag, saved))
    check(pg, 'tur slut', '#game', w, h, tag + '-tur-slut.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'tur-slut.png')
    # Værkstedet: køb motor
    pg.click('#btn-res-shop'); pg.wait_for_timeout(120)
    m0, c0 = st(pg, "[Rampen.game.p.upg.motor, Rampen.game.p.coins]")
    price = st(pg, "Rampen.game.price('motor')")
    pg.click('#upg-grid [data-upg="motor"]'); pg.wait_for_timeout(60)
    if st(pg, "[Rampen.game.p.upg.motor, Rampen.game.p.coins]") != [m0 + 1, c0 - price]: fails.append(tag + ' køb af motor virkede ikke')
    check(pg, 'værksted', '#shop', w, h, tag + '-vaerksted.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'vaerksted.png')
    # Ny bil: kræver en lang tur, og der spørges først
    pg.evaluate("Rampen.game.p.best = 1200; Rampen.game.p.carScore = 3456; Rampen.show('shop')"); pg.wait_for_timeout(80)
    pg.click('#btn-newcar'); pg.wait_for_timeout(80)
    if st(pg, "document.activeElement && document.activeElement.id") != 'btn-newcar-no': fails.append(tag + ' Ny bil: Nej har ikke fokus')
    check(pg, 'ny bil?', '#shop', w, h, tag + '-ny-bil.png')
    pg.click('#btn-newcar-yes'); pg.wait_for_timeout(80)
    if st(pg, "[Rampen.game.p.bil, Rampen.game.p.coins, Rampen.records.list('biler').some(e => e.score === 3456)]") != [2, 0, True]: fails.append(tag + ' Ny bil virkede ikke')
    # Pause
    pg.evaluate("Rampen.start()"); pg.wait_for_timeout(80); pg.mouse.move(1, 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if st(pg, "document.getElementById('pause-overlay').hidden"): fails.append(tag + ' Esc gav ikke pause')
    check(pg, 'pause', '#game', w, h, tag + '-pause.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
    # Glød kan slås fra
    pg.evaluate("Rampen.gameSettings.set('gloed', false)"); pg.wait_for_timeout(120)
    gl = st(pg, """[document.documentElement.dataset.rampenGloed, getComputedStyle(document.documentElement).getPropertyValue('--rampen-gloed').trim(), document.querySelectorAll('#rampen-ikoner symbol').length]""")
    if gl[0] != 'fra' or gl[1] != '0' or gl[2] < 20: fails.append('%s glød fra gav %s' % (tag, gl))
    check(pg, 'uden glød', '#game', w, h, tag + '-uden-gloed.png')
    pg.evaluate("Rampen.gameSettings.set('gloed', true)")

def sound_check(pg, w, h, tag):
    """Egne lyde: alle navne findes, de følger den fælles lydindstilling, og en tur giver lyde."""
    r = st(pg, """(() => { const l = Rampen.lyd, want = ['motor', 'opsendelse', 'boost', 'moent', 'hop', 'landing', 'koeb'];
      const missing = want.filter(n => !l.has(n));
      Rampen.settings.set('sound', true); const on = want.map(n => l.play(n, 0.5));
      Rampen.settings.set('sound', false); const off = want.map(n => l.play(n));
      Rampen.settings.set('sound', true);
      return [missing, on.filter(Boolean).length, off.filter(Boolean).length]; })()""")
    if r[0] or r[1] < 5 or r[2] != 0: fails.append('%s lyde: mangler %s, spillede %s med lyd til og %s med lyd fra' % (tag, r[0], r[1], r[2]))
    # En hel tur (uden animation) med optagelse af lydene
    pg.evaluate(RIG); pg.evaluate("""Rampen.settings.set('animation', false); window.__lyde = []; const l = Rampen.lyd;
      if (!l.__wrapped) { const p = l.play; l.play = function (n, x) { window.__lyde.push(n); return p.call(l, n, x); }; l.__wrapped = true; }
      Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()""")
    pg.wait_for_timeout(60)
    pg.evaluate("Rampen.launch()"); idle(pg)
    k = 0
    while st(pg, "Rampen.phase") == 'freeze' and k < 40:
        pg.evaluate("Rampen.decide(Rampen.game.flight.boosts > 0)"); idle(pg); k += 1
    heard = st(pg, "[...new Set(window.__lyde)]")
    for n in ['motor', 'opsendelse', 'boost', 'landing']:
        if n not in heard: fails.append('%s lyden %s blev ikke spillet på en tur (%s)' % (tag, n, heard))
    pg.click('#btn-res-shop'); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.game.p.coins = 999; window.__lyde = []"); pg.click('#upg-grid [data-upg="daek"]'); pg.wait_for_timeout(40)
    if 'koeb' not in st(pg, "window.__lyde"): fails.append(tag + ' køb gav ikke lyden koeb')
    print('OK   %dx%d lyde %s' % (w, h, sorted(heard)) if not [f for f in fails if f.startswith(tag) and 'lyd' in f] else 'FEJL %dx%d lyde' % (w, h))

def flying_shot(pg, w, h, tag, shots):
    """Bilen i luften (animation til), midt i en tur."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', true); Rampen.gameSettings.set('fart', 'rolig')")
    pg.evaluate("Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.launch()"); pg.wait_for_timeout(900)
    if st(pg, "Rampen.phase") != 'fly': fails.append('%s fase under flyvning: %s' % (tag, st(pg, "Rampen.phase")))
    check(pg, 'bilen flyver', '#game', w, h, tag + '-flyver.png')
    if shots and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
    pg.mouse.move(1, 1); pg.keyboard.press('Enter'); idle(pg)
    if st(pg, "Rampen.phase") != 'freeze': fails.append('%s Enter sprang ikke frem til beslutningen (%s)' % (tag, st(pg, "Rampen.phase")))
    pg.evaluate("Rampen.settings.set('animation', false)")

def dwell_check(pg, w, h, tag):
    """Ét dwell på Send afsted = én tur. Vinkelknappen gentager."""
    pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', true); Rampen.settings.set('dwellTime', 0.5); Rampen.start()"); pg.wait_for_timeout(120)
    a0 = st(pg, "Rampen.game.p.angle")
    x, y = center(pg, '#controls [data-ang="1"]'); pg.mouse.move(x, y)
    pg.evaluate("Rampen.settings.set('dwell', true)")
    try: pg.wait_for_function("Rampen.game.p.angle >= %d" % (a0 + 2), timeout=4000)
    except Exception: fails.append(tag + ' dwell på vinkel gentog ikke (%s)' % st(pg, "Rampen.game.p.angle"))
    x, y = center(pg, '#btn-launch'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Rampen.phase !== 'launch'", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Send afsted sendte ikke bilen')
    pg.evaluate("Rampen.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    pg.evaluate("Rampen.settings.set('animation', false)")
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))

def new_page(b, w, h, **kw):
    ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900, **kw)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    return ctx, pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        big = (w, h) == (1920, 1080)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx, pg = new_page(b, w, h)
        pg.goto(URL); pg.wait_for_timeout(400)
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'startskaerm.png')
        pg.evaluate("Rampen.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Rampen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Rampen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        pg.evaluate("Rampen.show('shop')"); pg.wait_for_timeout(80); check(pg,'værksted (ny)','#shop',w,h)
        flying_shot(pg, w, h, tag, big)
        gameplay(pg, w, h, tag, big)
        dwell_check(pg, w, h, tag)
        if big or small: sound_check(pg, w, h, tag)
        # Hovedbilledet for opløsningen: beslutningspunktet med vinger
        pg.evaluate(RIG); pg.evaluate("Rampen.settings.set('animation', false); Rampen.start(); Rampen.game.setAngle(40); Rampen.refresh()"); pg.wait_for_timeout(80)
        pg.evaluate("Rampen.launch()"); idle(pg); pg.mouse.move(1, 1)
        if SHOT: pg.screenshot(path=SHOT + tag + '.png')
        ctx.close()
    # Mindre bevægelse: resultatet vises med det samme
    ctx, pg = new_page(b, 1366, 768, reduced_motion='reduce')
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate(RIG); pg.evaluate("Rampen.start()"); pg.wait_for_timeout(80)
    pg.evaluate("Rampen.launch()"); pg.wait_for_timeout(150)
    t = st(pg, "[Rampen.tegn.animating, Rampen.phase]")
    print('%s reduced motion: animerer=%s, fase efter 0,15 s=%s' % ('OK  ' if t == [False, 'freeze'] else 'FEJL', t[0], t[1]))
    if t != [False, 'freeze']: fails.append('reduced motion: %s' % t)
    ctx.close()
    # Hallen med Rampen aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.goto(HALL + '?spil=rampen'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Rampen/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Rampen' not in rl or hall_errs: fails.append('hallen viser ikke Rampen som aktiv: %s %s' % (rl, hall_errs))
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
