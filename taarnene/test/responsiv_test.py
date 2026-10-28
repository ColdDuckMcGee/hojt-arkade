# Responsiv test af Tårnene: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px, felterne >= 80 px (vises som felt=..px) og ingen fejl i konsollen.
#
# Desuden spillet i browseren: vælg felt → byg-panel → byg, opgrader og sælg, stien kan
# ikke bebygges, tastatur, bølgen kører af sig selv (og trin for trin), Hurtigere visning,
# pause, bekræftelsen ved Afslut, game over, rekorder, glød fra, dwell (ét dwell = ét
# panel) og statisk visning ved prefers-reduced-motion. Til sidst hallen med Tårnene aktiv.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 taarnene/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     TAARNENE_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('TAARNENE_SKAERMBILLEDER')
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
  const name = e => e.id || e.dataset.type || e.dataset.tab || e.dataset.mode || e.dataset.recMode || e.dataset.tool || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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

def confirm_check(pg, w, h, tag, name, shot):
    vis = pg.evaluate("!document.getElementById('confirm-overlay').hidden && document.activeElement && document.activeElement.id")
    if vis != 'btn-confirm-no': fails.append('%s %s: bekræftelsen vises ikke / Nej har ikke fokus (%s)' % (tag, name, vis))
    check(pg, name, '#game', w, h, shot)
    r = pg.evaluate("""() => { const a = document.getElementById('btn-confirm-no').getBoundingClientRect(), b = document.getElementById('btn-confirm-yes').getBoundingClientRect();
      const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      return [Math.round(Math.min(a.width, a.height)), Math.round(Math.min(b.width, b.height)), Math.round(gap)]; }""")
    if min(r[0], r[1]) < MIN_BTN or r[2] < 32: fails.append('%s %s: knapper %s/%s px, afstand %s px' % (tag, name, r[0], r[1], r[2]))
def st(pg, expr): return pg.evaluate(expr)
def center(pg, sel):
    bb = pg.locator(sel).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def cell_center(pg, i):
    bb = pg.locator('#board .cell[data-i="%d"]' % i).bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
def click_cell(pg, i):
    x, y = cell_center(pg, i); pg.mouse.click(x, y); pg.wait_for_timeout(60)
FREE = "(() => { const g = Taarnene.game, n = g.state.map.w * g.state.map.h, o = []; for (let i = 0; i < n; i++) if (!g.isPath(i) && !g.state.towers[i]) o.push(i); return o; })()"
# Felter ved siden af stien (her gør tårnene noget)
NEAR = "(() => { const g = Taarnene.game, m = g.state.map, o = []; " \
       "for (let i = 0; i < m.w * m.h; i++) { if (g.isPath(i) || g.state.towers[i]) continue; const x = i % m.w, y = Math.floor(i / m.w); " \
       "if (m.path.some(p => Math.abs(p[0] - x) + Math.abs(p[1] - y) === 1)) o.push(i); } return o; })()"
def wait_build(pg, timeout=60000):
    pg.wait_for_function("Taarnene.game && Taarnene.game.state.phase !== 'boelge' && !Taarnene.animating", timeout=timeout); pg.wait_for_timeout(80)

def gameplay(pg, w, h, tag):
    pg.evaluate("Taarnene.start()"); pg.wait_for_timeout(150)
    near = st(pg, NEAR)
    # Stien kan ikke bebygges
    p0 = st(pg, "(() => { const m = Taarnene.game.state.map; return m.path[2][1] * m.w + m.path[2][0]; })()")
    click_cell(pg, p0)
    if st(pg, "document.getElementById('byg-overlay').hidden") is not True or 'stien' not in st(pg, "document.getElementById('hint').textContent"): fails.append(tag + ' stien gav ingen besked')
    # Byg via panelet
    click_cell(pg, near[0])
    if st(pg, "document.getElementById('byg-overlay').hidden"): fails.append(tag + ' byg-panelet åbnede ikke'); return
    check(pg, 'byg-panel', '#game', w, h, tag + '-byg.png')
    if (w, h) == (1920, 1080) and SHOT: pg.screenshot(path=SHOT + 'byg-panel.png')
    # Kanon er for dyr fra start (25 af 40 er ok – læg pengene ned først)
    m0 = st(pg, "Taarnene.game.state.money")
    pg.click('.taarn-valg[data-type=laser]'); pg.wait_for_timeout(60)
    r = st(pg, "[Taarnene.game.state.towers[%d] && Taarnene.game.state.towers[%d].type, Taarnene.game.state.money, document.getElementById('byg-overlay').hidden]" % (near[0], near[0]))
    if r != ['laser', m0 - 10, True]: fails.append('%s byg laser gav %s' % (tag, r))
    # Tårnpanelet: opgrader og sælg (nyt tårn sælges til fuld pris)
    click_cell(pg, near[0])
    if st(pg, "document.getElementById('taarn-overlay').hidden"): fails.append(tag + ' tårn-panelet åbnede ikke')
    if st(pg, "document.querySelectorAll('#board .tt-raekkevidde').length") != 1: fails.append(tag + ' rækkevidden vises ikke')
    check(pg, 'tårn-panel', '#game', w, h, tag + '-taarn.png')
    pg.click('#btn-opgrader'); pg.wait_for_timeout(60)
    if st(pg, "Taarnene.game.state.towers[%d].level" % near[0]) != 2: fails.append(tag + ' opgrader virkede ikke')
    click_cell(pg, near[0]); pg.click('#btn-saelg'); pg.wait_for_timeout(60)
    r = st(pg, "[!!Taarnene.game.state.towers[%d], Taarnene.game.state.money]" % near[0])
    if r != [False, m0]: fails.append('%s sælg (fortryd) gav %s, ventede [False, %d]' % (tag, r, m0))
    # For dyrt tårn kan ikke vælges
    pg.evaluate("Taarnene.game.state.money = 12; Taarnene.refresh()")
    click_cell(pg, near[1])
    r = st(pg, "[document.querySelector('.taarn-valg[data-type=kanon]').getAttribute('aria-disabled'), document.querySelector('.taarn-valg[data-type=laser]').getAttribute('aria-disabled')]")
    if r != ['true', None]: fails.append('%s for dyre tårne ikke låst: %s' % (tag, r))
    pg.click('.taarn-valg[data-type=kanon]', force=True); pg.wait_for_timeout(40)
    if st(pg, "!!Taarnene.game.state.towers[%d]" % near[1]) or 'mangler' not in st(pg, "document.getElementById('byg-sub').textContent"): fails.append(tag + ' kanon blev bygget uden penge')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(40)
    if not st(pg, "document.getElementById('byg-overlay').hidden"): fails.append(tag + ' Esc lukkede ikke panelet')
    pg.evaluate("Taarnene.game.state.money = 100; Taarnene.refresh()")
    # Tastatur: piletast viser markøren, Enter åbner panelet
    pg.mouse.move(1, 1); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(40)
    c = st(pg, "Taarnene.cursor")
    if c < 0 or 'cur' not in pg.locator('#board .cell[data-i="%d"]' % c).get_attribute('class').split(): fails.append(tag + ' markøren tegnes ikke')
    # Flyt markøren til et frit felt ved stien
    tgt = near[1]; mw = st(pg, "Taarnene.game.state.map.w")
    for _ in range(12):
        c = st(pg, "Taarnene.cursor")
        if c == tgt: break
        dx = tgt % mw - c % mw; dy = tgt // mw - c // mw
        pg.keyboard.press('ArrowRight' if dx > 0 else 'ArrowLeft' if dx < 0 else 'ArrowDown' if dy > 0 else 'ArrowUp')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(60)
    if st(pg, "document.getElementById('byg-overlay').hidden"): fails.append(tag + ' Enter åbnede ikke byg-panelet')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(60)  # første tårn har fokus: Laser
    if st(pg, "Taarnene.game.state.towers[%d] && Taarnene.game.state.towers[%d].type" % (tgt, tgt)) != 'laser': fails.append(tag + ' Enter i panelet byggede ikke')
    for i in near[2:5]:
        click_cell(pg, i); pg.click('.taarn-valg[data-type=%s]' % ('frost' if i == near[3] else 'puls' if i == near[4] else 'kanon')); pg.wait_for_timeout(40)
    # Bølgen kører af sig selv (hurtig visning til testen)
    pg.evaluate("Taarnene.gameSettings.set('hurtig', true)")
    pg.click('#btn-wave'); pg.wait_for_timeout(100)
    if st(pg, "Taarnene.game.state.phase") != 'boelge' or st(pg, "document.getElementById('wave-label').textContent").replace('\u00a0', ' ') != 'Pause og byg': fails.append(tag + ' bølgen startede ikke')
    pg.wait_for_timeout(1500)
    t = st(pg, "Taarnene.game.state.tick")
    if t < 2: fails.append(tag + ' bølgen kørte ikke af sig selv (trin %s)' % t)
    # Mens bølgen kører, kan der ikke bygges (kun efter Pause og byg)
    f = st(pg, FREE)[0]; click_cell(pg, f)
    if not st(pg, "document.getElementById('byg-overlay').hidden"): fails.append(tag + ' byg-panel under bølgen')
    if 'Pause og byg' not in st(pg, "document.getElementById('hint').textContent"): fails.append(tag + ' ingen besked om Pause og byg')
    pg.evaluate("Taarnene.gameSettings.set('hurtig', false)")
    pg.wait_for_timeout(1300)
    check(pg, 'spil i gang (bølge)', '#game', w, h, tag + '.png')
    if (w, h) == (1920, 1080) and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
    # Pause og byg midt i bølgen
    pg.click('#btn-wave')
    try: pg.wait_for_function("Taarnene.game.state.wavePaused && !Taarnene.animating", timeout=3000)
    except Exception: fails.append(tag + ' Pause og byg satte ikke bølgen på pause')
    t1 = st(pg, "Taarnene.game.state.tick"); pg.wait_for_timeout(1000)
    if st(pg, "Taarnene.game.state.tick") != t1: fails.append(tag + ' bølgen kørte videre i pausen')
    if st(pg, "document.getElementById('wave-label').textContent") != 'Fortsæt bølgen': fails.append(tag + ' Fortsæt bølgen mangler')
    # (flere fjender i køen, så bølgen varer længe nok til også at teste pausemenuen)
    pg.evaluate("Taarnene.game.state.money += 30; Taarnene.game.state.queue.push('kugle','kugle','kugle','kugle','kugle','kugle'); Taarnene.refresh()")
    pb = st(pg, NEAR)[0]; click_cell(pg, pb)
    if st(pg, "document.getElementById('byg-overlay').hidden"): fails.append(tag + ' byg-panelet åbnede ikke i bølgepausen')
    else:
        pg.click('.taarn-valg[data-type=laser]'); pg.wait_for_timeout(60)
        if st(pg, "[!!Taarnene.game.state.towers[%d], Taarnene.game.sellValue(%d)]" % (pb, pb)) != [True, 10]: fails.append(tag + ' byg i bølgepausen gav ikke fuld pris')
    check(pg, 'pause og byg', '#game', w, h, tag + '-pause-byg.png')
    if (w, h) == (1920, 1080) and SHOT: pg.screenshot(path=SHOT + 'pause-og-byg.png')
    pg.click('#btn-wave'); pg.wait_for_timeout(100)
    if st(pg, "[Taarnene.game.state.wavePaused, Taarnene.game.sellValue(%d)]" % pb) != [False, 7]: fails.append(tag + ' Fortsæt bølgen virkede ikke (eller fuld pris efter pausen)')
    # Byg i pausen fra pausemenuen
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if st(pg, "Taarnene.game.state.phase") == 'boelge':
        if st(pg, "document.getElementById('btn-pause-byg').hidden"): fails.append(tag + ' Byg i pausen mangler i pausemenuen')
        check(pg, 'pausemenu under bølge', '#game', w, h, tag + '-pause-boelge.png')
        pg.click('#btn-pause-byg')
        try: pg.wait_for_function("Taarnene.game.state.wavePaused || Taarnene.game.state.phase !== 'boelge'", timeout=3000)
        except Exception: fails.append(tag + ' Byg i pausen satte ikke bølgen på pause')
        pg.wait_for_timeout(100)
        if st(pg, "document.getElementById('pause-overlay').hidden") is not True: fails.append(tag + ' pausemenuen blev ikke lukket')
        if st(pg, "Taarnene.game.state.wavePaused"): pg.keyboard.press('s'); pg.wait_for_timeout(100)
        if st(pg, "Taarnene.game.state.wavePaused"): fails.append(tag + ' S fortsatte ikke bølgen')
    else: fails.append(tag + ' bølgen var slut før pausemenuen kunne testes'); pg.keyboard.press('Escape')
    pg.wait_for_timeout(1200)
    if not st(pg, "Taarnene.game.state.tick > %d" % t1): fails.append(tag + ' bølgen kørte ikke videre efter pausen')
    pg.evaluate("Taarnene.gameSettings.set('hurtig', true)")
    pg.evaluate("Taarnene.gameSettings.set('hurtig', true)")
    wait_build(pg)
    s = st(pg, "[Taarnene.game.state.cleared, Taarnene.game.state.wave, Taarnene.game.state.score > 0, Taarnene.game.state.kills > 0]")
    if s != [1, 2, True, True]: fails.append('%s efter bølge 1: %s' % (tag, s))
    # Trin for trin: Næste trin og Vis resten
    pg.evaluate("Taarnene.gameSettings.set('visning', 'trin')")
    pg.click('#btn-wave'); pg.wait_for_timeout(100)
    if st(pg, "document.getElementById('wave-label').textContent") != 'Næste trin': fails.append(tag + ' trin-knappen mangler')
    t0 = st(pg, "Taarnene.game.state.tick"); pg.wait_for_timeout(1200)
    if st(pg, "Taarnene.game.state.tick") != t0: fails.append(tag + ' trin for trin kørte af sig selv')
    pg.click('#btn-wave'); pg.wait_for_timeout(100)
    if st(pg, "Taarnene.game.state.tick") != t0 + 1: fails.append(tag + ' Næste trin virkede ikke')
    check(pg, 'trin for trin', '#game', w, h, tag + '-trin.png')
    pg.wait_for_timeout(500); pg.click('#btn-speed'); wait_build(pg)
    pg.evaluate("Taarnene.gameSettings.set('visning', 'auto')")
    if st(pg, "Taarnene.game.state.cleared") != 2: fails.append(tag + ' Vis resten gjorde ikke bølgen færdig')

def baner_check(pg, w, h, tag, big):
    """Banevalget: store knapper, alle baner passer med felter >= 80 px, og valget starter spillet."""
    pg.evaluate("Taarnene.show('menu')"); pg.wait_for_timeout(80)
    pg.click('#btn-start'); pg.wait_for_timeout(150)
    if st(pg, "document.getElementById('baner').hidden"): fails.append(tag + ' Start spil viste ikke banevalget'); return
    nb = st(pg, "document.querySelectorAll('.bane-btn').length")
    if nb < 3: fails.append('%s kun %s baner' % (tag, nb))
    check(pg, 'banevalg', '#baner', w, h, tag + '-baner.png')
    if big and SHOT: pg.screenshot(path=SHOT + 'banevalg.png')
    for b in st(pg, "Taarnene.logik.BANER.map(b => b.id)"):
        pg.evaluate("Taarnene.gameSettings.set('bane', '%s'); Taarnene.start()" % b); pg.wait_for_timeout(120)
        if st(pg, "Taarnene.game.state.map.bane") != b: fails.append('%s bane %s blev ikke valgt' % (tag, b))
        check(pg, 'bane ' + b, '#game', w, h, tag + '-bane-' + b + '.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'bane-%s.png' % b)
    pg.evaluate("Taarnene.show('menu')"); pg.wait_for_timeout(80)
    pg.click('#btn-start'); pg.wait_for_timeout(120)
    pg.click('.bane-btn[data-bane=hesteskoen]'); pg.wait_for_timeout(150)
    if st(pg, "[Taarnene.game && Taarnene.game.state.map.bane, Taarnene.gameSettings.get('bane'), document.getElementById('game').hidden]") != ['hesteskoen', 'hesteskoen', False]:
        fails.append(tag + ' klik på Hesteskoen startede ikke spillet på den bane')
    # Lyd: skud samles (højst én lyd pr. type, og ikke igen lige efter)
    r = st(pg, "(() => { const l = Taarnene.lyd; l.unlock(); const a = l.skud(['laser','laser','laser','kanon','puls']), b = l.skud(['laser','kanon']);"
               " const n = ['byg','saelg','opgrader','nedkaempet','slapIgennem','boelgeKlaret','gameOver'].every(x => l.names.includes(x)); return [a, b, n]; })()")
    if r[0] > 3 or r[1] != 0 or not r[2]: fails.append('%s lyd: skud %s/%s, navne %s' % (tag, r[0], r[1], r[2]))

def dwell_check(pg, w, h, tag):
    """Ét dwell = ét panel; panelets knap under blikket vælges ikke af sig selv."""
    pg.evaluate("Taarnene.start(); Taarnene.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(120)
    i = st(pg, NEAR)[0]
    x, y = cell_center(pg, i); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("Taarnene.settings.set('dwell', true)")
    try: pg.wait_for_function("!document.getElementById('byg-overlay').hidden", timeout=3000)
    except Exception: fails.append(tag + ' dwell på et felt åbnede ikke panelet')
    pg.wait_for_timeout(1500)
    if st(pg, "Object.keys(Taarnene.game.state.towers).length") != 0: fails.append(tag + ' dwell byggede af sig selv (knap under blikket)')
    x, y = center(pg, '.taarn-valg[data-type=laser]'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Taarnene.game.state.towers[%d]" % i, timeout=3000)
    except Exception: fails.append(tag + ' dwell på Laser byggede ikke')
    pg.evaluate("Taarnene.settings.set('dwell', false)"); pg.mouse.move(1, 1)
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
        m = st(pg, "Taarnene.chooseMap().id")
        cells = st(pg, "Taarnene.logik.allMaps().map(m => m.id + '=' + Math.round(Taarnene.cellSizeFor(m)))")
        print('     %dx%d valgt bane %s (felter %s) note: %s' % (w, h, m, cells, st(pg, "document.getElementById('size-note').textContent")))
        pg.evaluate("Taarnene.show('hjaelp')"); pg.wait_for_timeout(100)
        pages(pg, '#hjaelp', w, h, 'hjælp', tag+'-hjaelp')
        pg.evaluate("Taarnene.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Taarnene.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Taarnene.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        baner_check(pg, w, h, tag, big)
        pg.evaluate("Taarnene.gameSettings.set('bane', 'slangen'); Taarnene.start()"); pg.wait_for_timeout(150)
        check(pg,'spil start','#game',w,h, tag + '-spil-start.png')
        gameplay(pg, w, h, tag)
        # Glød kan slås fra
        pg.evaluate("Taarnene.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => [document.documentElement.dataset.ttGloed, getComputedStyle(document.querySelector('#board')).boxShadow,
                    getComputedStyle(document.querySelector('#hud-score')).textShadow, getComputedStyle(document.documentElement).getPropertyValue('--tt-taarn-glow').trim(),
                    document.querySelectorAll('#tt-grafik symbol').length]""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] != 'none' or g[3] != 'none' or g[4] < 15: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Taarnene.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        pg.click('#btn-quit'); pg.wait_for_timeout(100)
        confirm_check(pg, w, h, tag, 'bekræft afslut', small and tag + '-bekraeft.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if st(pg, "[document.getElementById('confirm-overlay').hidden, Taarnene.game.state.phase]") != [True, 'bygge']: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
        # Game over: et liv tilbage og en bølge uden tårne
        # (fjenderne gøres meget stærke, så tårnene bliver stående på billedet)
        pg.evaluate("(() => { const s = Taarnene.game.state; s.lives = 1; Taarnene.refresh(); })()")
        pts = st(pg, "Taarnene.game.state.score")
        pg.click('#btn-wave'); pg.evaluate("Taarnene.game.state.spec.hpMul = 1000")
        try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=30000)
        except Exception: fails.append(tag + ' game over blev ikke vist')
        if not st(pg, "Taarnene.records.list('uendelig').some(e => e.waves === 2 && e.score === %d && e.bane === Taarnene.game.state.map.bane)" % pts): fails.append(tag + ' rekorden blev ikke gemt (med bane)')
        split = st(pg, "!document.getElementById('btn-go-rec').hidden")
        check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
        if split:
            pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
            check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
            pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        ctx.close()
    # Mindre bevægelse: faste billeder, ingen glidning
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Taarnene.start()"); pg.click('#btn-wave'); pg.wait_for_timeout(200)
    a = st(pg, "[document.getElementById('game').classList.contains('calm'), Taarnene.animating]")
    pg.wait_for_timeout(1100)
    t = st(pg, "Taarnene.game.state.tick")
    ok = a == [True, True] and t >= 2
    print('%s reduced motion: calm/trin=%s, trin efter 1,3 s=%s' % ('OK  ' if ok else 'FEJL', a, t))
    if not ok: fails.append('reduced motion: %s %s' % (a, t))
    ctx.close()
    # Hallen med Tårnene aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.on('console', lambda m: hall_errs.append(m.text) if m.type == 'error' else None)
    pg.goto(HALL + '?spil=taarnene'); pg.wait_for_timeout(1500)
    tt = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Tårnene/.test(t))""")
    print('     hallen: %s, fejl %s' % (tt, hall_errs))
    if 'Spil Tårnene' not in tt or hall_errs: fails.append('hallen viser ikke Tårnene som aktiv: %s %s' % (tt, hall_errs))
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
