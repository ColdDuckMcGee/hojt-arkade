# Responsiv test af Løberen: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knapstørrelse >= 80 px og ingen fejl i konsollen. Gemmer skærmbilleder.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 loeberen/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     LOEBEREN_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
HALL = (ROOT.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('LOEBEREN_SKAERMBILLEDER')
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
  scr.querySelectorAll('button, a, canvas, h1, h2, h3, p:not(.sr-only), li, .hud, img, .setting-label, .trin-label, .value-box').forEach(e => {
     if (!vis(e)) return; const r = e.getBoundingClientRect();
     if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.clipped.push((e.id || e.tagName + '.' + e.className) + ' ' + [r.left,r.top,r.right,r.bottom].map(Math.round));
  });
  const bs = [...scr.querySelectorAll('button, a.btn')].filter(vis);
  const name = e => e.id || e.dataset.act || e.dataset.tab || e.dataset.diff || e.dataset.recDiff || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
     if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !bs[i].contains(bs[j]) && !bs[j].contains(bs[i]) && bs[i].closest('.overlay') === bs[j].closest('.overlay')) out.overlap.push(name(bs[i]) + '/' + name(bs[j])); }
  // canvas må ikke overlappe knapper
  const cv = scr.querySelector('canvas');
  if (cv && vis(cv)) { const c = cv.getBoundingClientRect(); bs.forEach(e => { if (e.closest('.overlay')) return; const b = e.getBoundingClientRect(); if (c.left < b.right - 1 && b.left < c.right - 1 && c.top < b.bottom - 1 && b.top < c.bottom - 1) out.overlap.push('banen/' + name(e)); }); }
  const ov = [...scr.querySelectorAll('.overlay')].find(o => !o.hidden);
  const counted = ov ? bs.filter(e => ov.contains(e)) : bs;
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
    if sel == '#game': extra = ' layout=%s knap=%spx bane=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), pg.evaluate("document.querySelector('#game').dataset.btn"), pg.evaluate("(() => { const r = document.getElementById('board').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); })()"))
    if r['zoomed']: extra += ' (zoom)'
    line = '%s %dx%d %-28s mindste knap=%spx (%s)%s' % ('OK  ' if ok else 'FEJL', w, h, name, r['minBtn'], r['minName'], extra)
    if not ok: line += ' ' + json.dumps({k: r[k] for k in ('scroll','inner','clipped','overlap','textOut')}, ensure_ascii=False)
    print(line)
    summary.setdefault('%dx%d' % (w, h), []).append((name, r['minBtn']))
    if not ok: fails.append(line)
    if SHOT and shot: pg.screenshot(path=SHOT + shot)
def pages(pg, scr, w, h, name):
    n = 1
    while True:
        check(pg, '%s side %d' % (name, n), scr, w, h)
        nxt = pg.locator(scr + ' .trin-nav:not([hidden]) .trin-next')
        if nxt.count() == 0 or nxt.is_disabled(): break
        nxt.click(); pg.wait_for_timeout(60); n += 1
        if n > 8: fails.append('for mange sider ' + name); break
    return n

def flow_test(b):
    """Rigtigt spil i browseren: klik, taster, animation, dwell, liv og rekorder."""
    ctx = b.new_context(viewport={'width':1366,'height':768}); pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('flow ' + m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('flow pageerror: ' + str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(200)
    def res(name, ok, info=''):
        line = '%s FLOW %-40s %s' % ('OK  ' if ok else 'FEJL', name, info); print(line)
        if not ok: fails.append(line)
    pg.click('[data-diff=normal]'); pg.click('#btn-start'); pg.wait_for_timeout(200)
    st = lambda: pg.evaluate("(() => { const s = Loeberen.run.state; return {m: s.meters, l: s.lives, lane: s.lane, over: s.over, busy: Loeberen.busy}; })()")
    keys = {'venstre': 'ArrowLeft', 'hoejre': 'ArrowRight', 'hop': 'ArrowUp', 'dyk': 'ArrowDown', 'bliv': 'Space'}
    # 4 sikre træk med klik og 4 med taster, med animation slået til
    for i in range(8):
        a = pg.evaluate("G => ['bliv','hop','dyk','venstre','hoejre'].find(a => Loeberen.run.possible(a) && Loeberen.run.safe(a) && !Loeberen.run.deadEnd(a))", None)
        before = st()
        if i < 4: pg.click('[data-act=%s]' % a)
        else: pg.keyboard.press(keys[a])
        pg.wait_for_timeout(1100)
        after = st()
        res('sikkert træk %d (%s, %s)' % (i + 1, a, 'klik' if i < 4 else 'tast'), after['m'] == before['m'] + 10 and after['l'] == before['l'] and not after['busy'], json.dumps(after))
    # umuligt valg er slået fra
    pg.evaluate("Loeberen.run.state.lane = 0; Loeberen.refresh()")
    res('umuligt valg er slået fra', pg.evaluate("document.querySelector('[data-act=venstre]').disabled") and not pg.evaluate("document.querySelector('[data-act=bliv]').disabled"))
    pg.evaluate("Loeberen.refresh()")
    # dwell: blik på en knap giver præcis ét træk
    pg.evaluate("() => { Loeberen.settings.set('dwell', true); Loeberen.settings.set('dwellTime', 0.6); }")
    a = pg.evaluate("['bliv','hop','dyk','hoejre'].find(a => Loeberen.run.possible(a) && Loeberen.run.safe(a) && !Loeberen.run.deadEnd(a))")
    t0 = pg.evaluate("Loeberen.run.state.turns")
    bb = pg.locator('[data-act=%s]' % a).bounding_box()
    pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2, steps=4)
    for _ in range(40):
        pg.wait_for_timeout(100)
        if pg.evaluate("Loeberen.run.state.turns") != t0: break
    pg.wait_for_timeout(2200)
    t1 = pg.evaluate("Loeberen.run.state.turns")
    pg.mouse.move(5, 5); pg.evaluate("Loeberen.settings.set('dwell', false)")
    res('dwell giver præcis ét træk', t1 == t0 + 1, '%d -> %d' % (t0, t1))
    pg.wait_for_timeout(1000)
    # tre forkerte valg: liv trækkes, game over ved 0, rekord gemmes
    for k in range(3):
        bad = pg.evaluate("['bliv','hop','dyk','venstre','hoejre'].find(a => Loeberen.run.possible(a) && !Loeberen.run.safe(a)) || null")
        if not bad:
            pg.evaluate("() => { const s = Loeberen.run.state.segs[0]; s.lanes = ['lav','lav','lav']; Loeberen.refresh(); }"); bad = 'bliv'
        m_before = st()['m']
        pg.click('[data-act=%s]' % bad); pg.wait_for_timeout(1300)
        s2 = st()
        res('forkert valg %d koster et liv og giver 0 m' % (k + 1), s2['l'] == 2 - k and s2['m'] == m_before, json.dumps(s2))
        if k < 2:
            res('  "Du mistede et liv" vises', pg.evaluate("!document.getElementById('death-overlay').hidden"))
            pg.click('#btn-continue'); pg.wait_for_timeout(500)
    rec = pg.evaluate("Loeberen.records.list('normal')")
    res('rekord gemt straks ved sidste liv', len(rec) == 1, json.dumps(rec)[:120])
    res('  "Det sidste liv er brugt" vises', pg.evaluate("document.getElementById('death-title').textContent") == 'Det sidste liv er brugt')
    pg.click('#btn-continue'); pg.wait_for_timeout(300)
    res('game over ved 0 liv', pg.evaluate("!document.getElementById('gameover').hidden"))
    rec = pg.evaluate("Loeberen.records.list('normal')")
    res('rekord gemt én gang i top 10', len(rec) == 1 and rec[0]['score'] == pg.evaluate("Loeberen.run.state.score"), json.dumps(rec)[:120])
    pg.reload(); pg.wait_for_timeout(200)
    res('rekord findes efter genindlæsning', len(pg.evaluate("Loeberen.records.list('normal')")) == 1)
    ctx.close()
# Find et stop, hvor et bestemt valg er forkert, og et andet er sikkert
SAFE_ACT = "() => Loeberen.run.safeActions()[0]"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        tag = 'responsiv-%dx%d' % (w, h)
        big = (w, h) == (1920, 1080)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.goto(URL); pg.wait_for_timeout(250)
        pg.evaluate("() => { localStorage.clear(); }"); pg.reload(); pg.wait_for_timeout(250)
        check(pg, 'startmenu', '#menu', w, h, big and 'startskaerm.png')
        pg.evaluate("Loeberen.show('om')"); pg.wait_for_timeout(80); pages(pg, '#om', w, h, 'om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Loeberen.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab)
        pg.evaluate("Loeberen.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h)
        # spillet
        pg.evaluate("() => { Loeberen.settings.set('animation', false); Loeberen.start(); }"); pg.wait_for_timeout(150)
        for i in range(6):
            a = pg.evaluate(SAFE_ACT); pg.evaluate("a => Loeberen.act(a)", a); pg.wait_for_timeout(30)
        pg.wait_for_timeout(400)
        # forhåndsvisning af et sikkert valg
        pg.evaluate("() => Loeberen.preview(Loeberen.run.safeActions()[0])"); pg.wait_for_timeout(60)
        check(pg, 'spil', '#game', w, h, tag + '.png')
        if big: SHOT and pg.screenshot(path=SHOT + 'spil.png')
        if big:
            # løberen oppe på en datablok: fast opstilling, så billedet viser højden tydeligt
            pg.evaluate("""() => { const s = Loeberen.run.state; let n = 900; const mk = (l, c) => ({id: n++, lanes: l, coins: c || [false, false, false]});
                s.lane = 1; s.h = 1; s.prev = mk(['fri', 'rampe', 'lav']);
                s.segs[0] = mk(['mur', 'blok', 'hoej'], [false, true, false]); s.segs[1] = mk(['rampe', 'blok-lav', 'fri']);
                s.segs[2] = mk(['blok', 'blok', 'mur'], [true, false, false]); s.segs[3] = mk(['blok', 'fri', 'lav']);
                s.segs[4] = mk(['fri', 'hoej', 'rampe']); s.segs[5] = mk(['lav', 'fri', 'blok']);
                Loeberen.preview('bliv'); }"""); pg.wait_for_timeout(60)
            check(pg, 'spil oppe på blok', '#game', w, h, 'spil-oppe.png')
            pg.evaluate("() => Loeberen.preview(null)")
        # forhåndsvisning af et forkert valg (hvis der er et)
        bad = pg.evaluate("() => ['bliv','hop','dyk','venstre','hoejre'].find(a => Loeberen.run.possible(a) && !Loeberen.run.safe(a)) || null")
        if bad and big:
            pg.evaluate("a => Loeberen.preview(a)", bad); pg.wait_for_timeout(60)
            SHOT and pg.screenshot(path=SHOT + 'spil-forkert-valg.png')
        pg.evaluate("() => Loeberen.preview(null)")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
        # et forkert valg: mistet liv
        if bad:
            pg.evaluate("a => Loeberen.act(a)", bad); pg.wait_for_timeout(200)
            check(pg, 'mistet liv', '#game', w, h, big and 'mistet-liv.png')
            pg.click('#btn-continue'); pg.wait_for_timeout(100)
        # game over med rekorder
        pg.evaluate("() => { const s = Loeberen.run.state; for (let i = 0; i < 3; i++) Loeberen.records.add('normal', 300 + i * 40, {meters: 280 + i * 30, coins: 2}); s.meters = 1230; s.coins = 14; s.score = 1370; s.lives = 0; s.over = true; s.lastCause = 'mur'; Loeberen.gameOver(); }")
        pg.wait_for_timeout(150)
        split = pg.evaluate("!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, big and 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h)
        ctx.close()
    if not os.environ.get('ONLY'): flow_test(b)
    # hallen med Løberen aktiv
    if not os.environ.get('ONLY'):
        ctx = b.new_context(viewport={'width':1920,'height':1080}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('hal pageerror: ' + str(e)))
        pg.goto(HALL); pg.wait_for_timeout(800)
        idx = pg.evaluate("(window.HOJT_SPIL || []).findIndex(x => x.sti === 'loeberen/')")
        for _ in range(max(0, idx)): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(120)
        pg.wait_for_timeout(900)
        found = pg.evaluate("() => { const g = (window.HOJT_SPIL || []).find(x => x.sti === 'loeberen/'); return g ? g.status + ' ' + g.skaerm : 'mangler'; }")
        print('HAL: Løberen =', found)
        if found != 'aktiv hal/skaerme/loeberen.svg': fails.append('hallen: ' + found)
        SHOT and pg.screenshot(path=SHOT + 'hal.png')
        ctx.close()
    b.close()
print()
print('MINDSTE KNAP PR. OPLØSNING:')
for k, v in summary.items(): print('  %-10s %s px' % (k, min(x[1] for x in v if x[1] is not None)))
print('KONSOL:', errs)
print('FEJL:', len(fails))
for f in fails: print('  ', f)
sys.exit(1 if fails or errs else 0)
