# Responsiv test af Billard: alle skærme ved 8 opløsninger.
# Tjekker: ingen rulning, intet klippet af, ingen overlap, tekst inden i knapperne,
# mindste knap >= 80 px og ingen fejl eller advarsler i konsollen.
#
# Desuden spillet i browseren: drej med knapper og tastatur, kraft, klik på bordet for
# at sigte, Næste kugle, åbningsstødet (knapperne er låst, mens kuglerne ruller),
# computerens tur, fejlstød = kuglen i hånden med Flyt, pause, bekræftelsen ved Afslut,
# parti vundet + Næste parti, tabt parti = game over med rekord pr. niveau, glød fra,
# dwell (ét dwell på Stød = ét stød; drejeknapperne gentager) og straks slutposition
# ved prefers-reduced-motion. Til sidst hallen med Billard aktiv.
#
# Kræver Python med Playwright og Chrome/Chromium:
#   python3 billard/test/responsiv_test.py
# Miljøvariabler (valgfri):
#   CHROME=/sti/til/chrome     BILLARD_SKAERMBILLEDER=/mappe   ONLY=844x390,390x844
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
HALL = (pathlib.Path(__file__).resolve().parent.parent.parent / 'index.html').as_uri()
SHOT_DIR = os.environ.get('BILLARD_SKAERMBILLEDER', '/workspace/billard/screenshots')
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
  const cv = scr.querySelector('#table'); out.board = cv && vis(cv) ? [Math.round(cv.getBoundingClientRect().width), Math.round(cv.getBoundingClientRect().height)] : null;
  const name = e => e.id || e.dataset.slot || e.dataset.tab || e.dataset.level || e.dataset.recLevel || e.dataset.turn && ('drej' + e.dataset.turn) || e.dataset.power && ('kraft' + e.dataset.power) || e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g,' ').slice(0,16);
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
    if sel == '#game': extra += ' layout=%s bord=%s' % (pg.evaluate("document.querySelector('#game').dataset.layout"), r['board'])
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


def B(pg, expr): return pg.evaluate(expr)
def wait_idle(pg, human=True):
    """Vent til kuglerne ligger stille (og computeren er færdig, hvis human)."""
    pg.wait_for_function("!Billard.rolling" + (" && (!Billard.run.live() || Billard.run.state.turn === 'human') && !Billard.rolling" if human else ""), timeout=30000)
    pg.wait_for_timeout(80)
def set_power(pg, p):
    for _ in range(12):
        cur = B(pg, "Billard.run.state.power")
        if cur == p: return
        pg.keyboard.press('ArrowUp' if cur < p else 'ArrowDown')
# Stil kuglerne op. balls: [[id, x, y], ...]; opts som run._setBalls.
def setup(pg, balls, opts):
    pg.evaluate("""([b, o]) => { Billard.run._setBalls(b.map(x => ({id: x[0], x: x[1], y: x[2], in: true})), o); Billard.begin(); Billard.layout(); }""", [balls, opts])
WIN8 = [[0, 300, 300], [8, 100, 100], [12, 700, 380]]            # 8'eren lige mod hjørnet (retning 225, kraft 6)
EARLY8 = [[0, 300, 300], [8, 100, 100], [3, 700, 380], [12, 640, 120]]
GROUPS = {'human': 'hel', 'cpu': 'halv'}

def gameplay(pg, w, h, tag):
    pg.evaluate("Billard.setDelays(0, 0, 0); Billard.start(12345)"); pg.wait_for_timeout(150)
    pg.mouse.move(1, 1)
    a0 = B(pg, "Billard.run.state.aim")
    pg.click('#controls [data-turn="10"]'); pg.click('#controls [data-turn="-1"]')
    if B(pg, "Billard.run.state.aim") != (a0 + 9) % 360: fails.append('%s drejeknapper gav %s (fra %s)' % (tag, B(pg, "Billard.run.state.aim"), a0))
    pg.mouse.move(1, 1)
    pg.keyboard.press('Shift+ArrowLeft'); pg.keyboard.press('ArrowRight')
    if B(pg, "Billard.run.state.aim") != a0: fails.append('%s piletaster drejede forkert (%s)' % (tag, B(pg, "Billard.run.state.aim")))
    # v1.2: seks drejeknapper (10°, 1°, 0,1°), retning med én decimal, Alt/Ctrl+pil = 0,1°
    rb = B(pg, "[...document.querySelectorAll('#controls .rot-btn')].map(e => [e.dataset.turn, e.textContent.replace(/\\s+/g, ' ').trim(), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)])")
    if sorted(r[0] for r in rb) != sorted(['-10', '10', '-1', '1', '-0.1', '0.1']): fails.append('%s drejeknapper: %s' % (tag, rb))
    for r in rb:
        if min(r[2], r[3]) < 80: fails.append('%s drejeknap %s er %sx%s' % (tag, r[0], r[2], r[3]))
        if not any(wd in r[1] for wd in ('grov', 'mellem', 'fin')): fails.append('%s drejeknap %s mangler etiket: %s' % (tag, r[0], r[1]))
    pg.evaluate("Billard.run.setAim(274); Billard.refresh()")
    pg.click('#controls [data-turn="0.1"]'); pg.click('#controls [data-turn="0.1"]'); pg.click('#controls [data-turn="0.1"]'); pg.click('#controls [data-turn="-0.1"]')
    pg.mouse.move(1, 1); pg.wait_for_timeout(30)
    g = B(pg, "[Billard.run.state.aim, document.getElementById('dir-value').textContent.trim(), (Math.round(Billard.tegn.screenAngle(274.2) * 10) / 10).toFixed(1).replace('.', ',')]")
    if g[0] != 274.2 or g[2] + '°' != g[1] or ',' not in g[1]: fails.append('%s 0,1°-knapper/visning gav %s' % (tag, g))
    pg.keyboard.press('Alt+ArrowRight'); pg.keyboard.press('Alt+ArrowRight'); pg.keyboard.press('Control+ArrowLeft')
    if B(pg, "Billard.run.state.aim") != 274.3: fails.append('%s Alt/Ctrl+pil gav %s' % (tag, B(pg, "Billard.run.state.aim")))
    pg.evaluate("Billard.run.setAim(%s); Billard.refresh()" % a0)
    # Alle 15 kugler + stødbolden tegnes ved start, også 8'eren
    dr = B(pg, "(() => { const t = window.BillardTema.tegn, o = t.kugle, seen = []; t.kugle = function (c, b) { seen.push([b.nr, b.type]); return o.apply(this, arguments); }; Billard.refresh(); t.kugle = o; return seen; })()")
    ids = sorted(set(d[0] for d in dr))
    if ids != list(range(16)) or [8, 'otte'] not in dr: fails.append('%s tegnede kugler ved start: %s' % (tag, dr))
    p0 = B(pg, "Billard.run.state.power")
    pg.click('#controls [data-power="1"]')
    if B(pg, "[Billard.run.state.power, document.querySelectorAll('#pow-meter i.on').length]") != [p0 + 1, p0 + 1]: fails.append(tag + ' kraft + virkede ikke')
    pg.keyboard.press('ArrowDown')
    # Klik på bordet sigter dertil: fodpunktet → retningen 0 (ligeud)
    pt = B(pg, "(() => { const c = document.getElementById('table').getBoundingClientRect(), p = Billard.tegn.toScreen(750, 250); return [c.left + p.x, c.top + p.y]; })()")
    pg.evaluate("Billard.run.setAim(90); Billard.refresh()")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(40)
    got = B(pg, "Billard.run.state.aim")
    if min(got, 360 - got) > 1: fails.append('%s klik på bordet sigtede %s, ventede 0' % (tag, got))
    # Åbningsstødet: knapperne låses, mens kuglerne ruller
    set_power(pg, 10)
    pg.click('#btn-shoot'); pg.wait_for_timeout(60)
    if not B(pg, "Billard.rolling && document.getElementById('btn-shoot').disabled"): fails.append(tag + ' Stød låste ikke knapperne')
    wait_idle(pg)
    r = B(pg, "[Billard.run.state.breakShot, Billard.run.state.balls.filter(b => b.in).length <= 16]")
    if r != [False, True]: fails.append('%s åbningsstødet gav %s' % (tag, r))
    check(pg, 'spil i gang (efter åbningsstødet)', '#game', w, h)
def next_ball_check(pg, w, h, tag):
    setup(pg, [[0, 300, 250], [2, 500, 150], [5, 620, 400], [10, 600, 350], [8, 800, 250]], {'groups': GROUPS, 'turn': 'human'})
    pg.mouse.move(1, 1)
    p0 = B(pg, "Billard.run.state.power")
    pg.click('#btn-next-ball'); pg.wait_for_timeout(40)
    a = B(pg, "[Billard.run.preview().hit.id, Billard.hint]")
    if B(pg, "Billard.run.state.power") != p0: fails.append('%s Næste kugle ændrede kraften' % tag)
    pg.keyboard.press('n'); pg.wait_for_timeout(40)
    b = B(pg, "Billard.run.preview().hit.id")
    if a[0] not in (2, 5) or b not in (2, 5) or a[0] == b or 'Kugle ' not in a[1] or 'Finjustér selv' not in a[1]: fails.append('%s Næste kugle gav %s / %s' % (tag, a, b))
def hand_check(pg, w, h, tag):
    """Computerens fejlstød → du har kuglen i hånden, Flyt flytter den."""
    setup(pg, [[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]], {'groups': {'human': 'halv', 'cpu': 'hel'}, 'turn': 'human'})
    # Et fejlstød fra dig: ingen kugle ramt → computeren får kuglen i hånden og støder
    pg.evaluate("Billard.setDelays(4000, 4000, 0); Billard.run.setAim(90); Billard.run.setPower(1); Billard.refresh()")
    pg.evaluate("Billard.shoot()"); wait_idle(pg, False)
    r = B(pg, "[Billard.run.state.last.who, Billard.run.state.last.judge.foul, Billard.run.state.turn, Billard.run.state.ballInHand, Billard.hint]")
    if r[:4] != ['human', True, 'cpu', True] or 'Fejlstød: Stødbolden ramte ingen kugle' not in r[4]: fails.append('%s dit fejlstød gav %s' % (tag, r))
    pg.evaluate("Billard.setDelays(0, 0, 0)")
    # Nu: dig med kuglen i hånden (sæt det op direkte)
    setup(pg, [[0, 300, 250], [2, 500, 150], [10, 600, 350], [11, 420, 300], [8, 800, 250]], {'groups': {'human': 'halv', 'cpu': 'hel'}, 'turn': 'human', 'hand': True})
    c0 = B(pg, "(() => { const c = Billard.run.state.balls.find(b => b.id === 0); return [c.x, c.y]; })()")
    if B(pg, "document.getElementById('btn-move-cue').disabled"): fails.append(tag + ' Flyt er ikke aktiv med kuglen i hånden'); return
    check(pg, 'kuglen i hånden', '#game', w, h, tag + '-haand.png')
    pg.mouse.move(1, 1); pg.click('#btn-move-cue'); pg.wait_for_timeout(40)
    c1 = B(pg, "(() => { const c = Billard.run.state.balls.find(b => b.id === 0); return [c.x, c.y]; })()")
    if c0 == c1: fails.append(tag + ' Flyt flyttede ikke stødbolden')
    pg.keyboard.press('f'); pg.wait_for_timeout(40)
    if B(pg, "(() => { const c = Billard.run.state.balls.find(b => b.id === 0); return [c.x, c.y]; })()") == c1: fails.append(tag + ' F flyttede ikke stødbolden')
def win_and_lose(pg, w, h, tag, small):
    # Parti vundet
    setup(pg, WIN8, {'groups': GROUPS, 'turn': 'human'})
    pg.evaluate("Billard.run.setAim(225); Billard.run.setPower(6); Billard.refresh()")
    sc0 = B(pg, "Billard.run.state.score")
    pg.keyboard.press('Enter'); wait_idle(pg, False)
    pg.wait_for_timeout(30)
    nt = B(pg, "document.getElementById('hint').textContent")
    if "8'eren er i hul – partiet er vundet" not in nt: fails.append('%s beskeden ved 8\'eren i hul var: %s' % (tag, nt))
    try: pg.wait_for_function("!document.getElementById('done-overlay').hidden", timeout=3000)
    except Exception: fails.append(tag + ' Parti vundet blev ikke vist'); return None
    s = B(pg, "[Billard.run.state.framesWon, Billard.run.state.score - %d, document.getElementById('done-title').textContent]" % sc0)
    if s[0] != 1 or s[1] != 200 or s[2] != 'Parti vundet!': fails.append('%s parti vundet gav %s' % (tag, s))
    check(pg, 'parti vundet', '#game', w, h, tag + '-parti-vundet.png')
    pg.click('#btn-done-quit'); pg.wait_for_timeout(100)
    confirm_check(pg, w, h, tag, 'bekræft afslut (parti vundet)', small and tag + '-bekraeft.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if B(pg, "[document.getElementById('confirm-overlay').hidden, document.getElementById('done-overlay').hidden, Billard.run.state.ended]") != [True, False, False]: fails.append(tag + ' Esc i bekræftelsen gik ikke tilbage')
    pg.click('#btn-next'); pg.wait_for_timeout(100)
    if B(pg, "[Billard.run.state.frame, Billard.run.state.framesWon, document.getElementById('done-overlay').hidden]") != [2, 1, True]: fails.append(tag + ' Næste parti virkede ikke')
    wait_idle(pg)                      # computeren slår op og spiller, til det er din tur
    check(pg, 'parti 2', '#game', w, h)
    pts = B(pg, "Billard.run.state.score")
    # Tabt parti: 8'eren før tid → game over
    if not B(pg, "Billard.run.live()"):
        fails.append(tag + ' parti 2 sluttede, før testen nåede det (%s)' % B(pg, "Billard.run.state.frameOver")); return None
    setup(pg, EARLY8, {'groups': GROUPS, 'turn': 'human'})
    pg.evaluate("Billard.run.setAim(225); Billard.run.setPower(6); Billard.refresh()")
    pg.keyboard.press('Enter')
    try: pg.wait_for_function("!document.getElementById('gameover').hidden", timeout=6000)
    except Exception: fails.append(tag + ' game over blev ikke vist'); return None
    lv = B(pg, "Billard.run.state.level")
    if not B(pg, "Billard.records.list('%s').some(e => e.score === %d && e.frames === 1)" % (lv, pts)): fails.append('%s rekorden blev ikke gemt (%s, %s)' % (tag, lv, pts))
    reason = B(pg, "document.getElementById('go-reason').textContent")
    if "8'eren er i hul – partiet er tabt" not in reason: fails.append(tag + ' game over viser ikke grunden: ' + reason)
    return pts
def dwell_check(pg, w, h, tag):
    """Ét dwell på Stød = ét stød. Drejeknappen gentager."""
    pg.evaluate("Billard.start(777); Billard.settings.set('dwellTime', 0.5)"); pg.wait_for_timeout(120)
    setup(pg, [[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]], {'groups': GROUPS, 'turn': 'human'})
    pg.evaluate("Billard.run.setAim(180); Billard.run.setPower(1); Billard.refresh()")
    x, y = center(pg, '#btn-shoot'); pg.mouse.move(x, y); pg.wait_for_timeout(30)
    pg.evaluate("window.__shots = 0; const o = Billard.run.shoot; Billard.run.shoot = function () { if (Billard.run.state.turn === 'human') window.__shots++; return o.apply(this, arguments); }; 0")
    pg.evaluate("Billard.settings.set('dwell', true)")
    try: pg.wait_for_function("window.__shots === 1", timeout=3000)
    except Exception: fails.append(tag + ' dwell på Stød stødte ikke')
    wait_idle(pg); pg.wait_for_timeout(1400)
    if B(pg, "window.__shots") != 1: fails.append(tag + ' dwell på Stød stødte igen uden at blikket flyttede sig')
    # Gør det til din tur igen og test gentagelse på drej
    setup(pg, [[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]], {'groups': GROUPS, 'turn': 'human'})
    pg.evaluate("Billard.run.setAim(0); Billard.refresh()")
    a0 = B(pg, "Billard.run.state.aim")
    x, y = center(pg, '#controls [data-turn="1"]'); pg.mouse.move(x, y, steps=3)
    try: pg.wait_for_function("Billard.run.state.aim === %d" % ((a0 + 2) % 360), timeout=5000)
    except Exception: fails.append(tag + ' dwell på drej gentog ikke (%s)' % B(pg, "Billard.run.state.aim"))
    pg.evaluate("Billard.settings.set('dwell', false)"); pg.mouse.move(1, 1)
    print('OK   %dx%d dwell' % (w, h) if not [f for f in fails if f.startswith(tag) and 'dwell' in f] else 'FEJL %dx%d dwell' % (w, h))
def game_shot(pg):
    """Et spil i gang: efter åbningsstødet, med Næste kugle (forhåndslinjen ses)."""
    pg.evaluate("Billard.setDelays(0, 0, 0); Billard.start(31); Billard.run.setPower(10); Billard.refresh()"); pg.wait_for_timeout(100)
    pg.evaluate("Billard.shoot()"); wait_idle(pg)
    pg.evaluate("Billard.setDelays(700, 1100, 1300)")
    pg.mouse.move(1, 1)
    if B(pg, "Billard.run.live()"): pg.keyboard.press('n')
    pg.wait_for_timeout(80)

def newpage(ctx):
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    return pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=['--no-sandbox'])
    for (w,h) in [x for x in SIZES if not os.environ.get('ONLY') or '%dx%d'%x in os.environ['ONLY'].split(',')]:
        small = min(w, h) < 560
        big = (w, h) == (1920, 1080)
        tag = 'responsiv-%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=w < 900)
        pg = newpage(ctx)
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg,'start','#menu',w,h, tag+'-start.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'startskaerm.png')
        # Niveauknapperne
        pg.click('#menu [data-level="svaer"]'); pg.wait_for_timeout(40)
        if B(pg, "Billard.gameSettings.get('niveau')") != 'svaer': fails.append(tag + ' niveauknappen virkede ikke')
        pg.click('#menu [data-level="normal"]')
        pg.evaluate("Billard.show('om')"); pg.wait_for_timeout(100)
        pages(pg, '#om', w, h, 'om', small and tag+'-om')
        for tab in ['styring','udseende','lyd']:
            pg.evaluate("Billard.show('settings')"); pg.click('[data-tab=%s]' % tab); pg.wait_for_timeout(80)
            pages(pg, '#settings', w, h, 'indstillinger/'+tab, small and '%s-indstillinger-%s' % (tag, tab))
        pg.evaluate("Billard.show('records')"); pg.wait_for_timeout(80); check(pg,'rekorder','#records',w,h, small and tag+'-rekorder.png')
        gameplay(pg, w, h, tag)
        next_ball_check(pg, w, h, tag)
        hand_check(pg, w, h, tag)
        # Computerens tur: tænker og sigter (forhåndslinjen vises), låste knapper
        pg.evaluate("Billard.setDelays(5000, 5000, 0)")
        setup(pg, [[0, 300, 250], [2, 500, 150], [10, 600, 350], [8, 800, 250]], {'groups': GROUPS, 'turn': 'cpu'})
        pg.wait_for_timeout(60)
        r = B(pg, "[Billard.cpuPhase, document.getElementById('btn-shoot').disabled, document.getElementById('hud-cpu-box').classList.contains('tur'), Billard.hint]")
        if r[0] != 'think' or not r[1] or not r[2] or 'tænker' not in r[3]: fails.append('%s computerens tur gav %s' % (tag, r))
        check(pg, 'computerens tur', '#game', w, h, small and tag + '-computer.png')
        # Pause under computerens tur stopper den
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg,'pause','#game',w,h, small and tag+'-pause.png')
        if B(pg, "document.getElementById('pause-overlay').hidden || Billard.cpuPhase !== null"): fails.append(tag + ' Esc gav ikke pause')
        pg.evaluate("Billard.setDelays(0, 0, 0)")
        pg.keyboard.press('Escape'); wait_idle(pg)
        # Skærmbillede: et spil i gang med forhåndslinje
        game_shot(pg)
        check(pg,'spil i gang','#game',w,h, tag+'.png')
        if big and SHOT: pg.screenshot(path=SHOT + 'spil-i-gang.png')
        # Glød kan slås fra
        pg.evaluate("Billard.gameSettings.set('gloed', false)"); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => [document.documentElement.dataset.billardGloed, getComputedStyle(document.querySelector('#table')).boxShadow,
                    getComputedStyle(document.documentElement).getPropertyValue('--billard-gloed').trim(),
                    document.querySelectorAll('#billard-ikoner symbol').length]""")
        if g[0] != 'fra' or g[1] != 'none' or g[2] != '0' or g[3] < 9: fails.append('%s glød fra gav %s' % (tag, g))
        check(pg,'spil uden glød','#game',w,h, tag+'-uden-gloed.png')
        pg.evaluate("Billard.gameSettings.set('gloed', true)"); pg.wait_for_timeout(40)
        pg.evaluate("Billard.setDelays(0, 0, 0)")
        # Parti vundet → parti 2 → tabt → game over
        pg.evaluate("Billard.start(4242)"); pg.wait_for_timeout(60)
        pts = win_and_lose(pg, w, h, tag, small)
        if pts is not None:
            split = B(pg, "!document.getElementById('btn-go-rec').hidden")
            check(pg,'game over' + (' (resultat)' if split else ''),'#gameover',w,h, tag+'-gameover.png')
            if big and SHOT: pg.screenshot(path=SHOT + 'game-over.png')
            if split:
                pg.click('#btn-go-rec'); pg.wait_for_timeout(80)
                check(pg,'game over (rekorder)','#gameover',w,h, tag+'-gameover-trin2.png')
                pg.click('#btn-go-rec'); pg.wait_for_timeout(60)
        dwell_check(pg, w, h, tag)
        # Hovedbilledet for opløsningen: spillet i gang
        game_shot(pg)
        if SHOT: pg.screenshot(path=SHOT + tag + '.png')
        ctx.close()
    # Rekorder pr. niveau: to niveauer giver to lister
    ctx = b.new_context(viewport={'width':1366,'height':768})
    pg = newpage(ctx)
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Billard.setDelays(0, 0, 0)")
    for lv, sc in [('rolig', 1), ('svaer', 3)]:
        pg.evaluate("Billard.gameSettings.set('niveau', '%s'); Billard.start(5)" % lv); pg.wait_for_timeout(60)
        setup(pg, [[0, 300, 300], [1, 100, 100], [8, 800, 250], [12, 700, 380]], {'groups': GROUPS, 'turn': 'human'})
        pg.evaluate("Billard.run.setAim(225); Billard.run.setPower(6); Billard.refresh(); Billard.shoot()"); wait_idle(pg)
        pg.evaluate("Billard.finish('quit')"); pg.wait_for_timeout(60)
    r = B(pg, "[Billard.records.list('rolig').map(e => e.score), Billard.records.list('svaer').map(e => e.score), Billard.records.list('normal').length]")
    ok = r[0] == [10] and r[1] == [30] and r[2] == 0
    print('%s rekorder pr. niveau: %s' % ('OK  ' if ok else 'FEJL', r))
    if not ok: fails.append('rekorder pr. niveau: %s' % r)
    pg.evaluate("Billard.show('records')"); pg.click('[data-rec-level=svaer]'); pg.wait_for_timeout(60)
    if '30' not in B(pg, "document.querySelector('#records ol').textContent"): fails.append('rekordlisten Svær viser ikke 30 point')
    if SHOT: pg.screenshot(path=SHOT + 'ekstra/rekorder-svaer.png')
    ctx.close()
    # Mindre bevægelse: kuglerne står straks ved slutpositionen
    ctx = b.new_context(viewport={'width':1366,'height':768}, reduced_motion='reduce')
    pg = newpage(ctx)
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("Billard.start(9)")
    setup(pg, WIN8, {'groups': GROUPS, 'turn': 'human'})
    pg.evaluate("Billard.run.setAim(225); Billard.run.setPower(6); Billard.refresh()")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1800)
    t = B(pg, "[document.getElementById('game').classList.contains('calm'), Billard.tegn.animating, !document.getElementById('done-overlay').hidden]")
    print('%s reduced motion: calm=%s animerer=%s, parti vundet efter 1,8 s=%s' % ('OK  ' if t == [True, False, True] else 'FEJL', t[0], t[1], t[2]))
    if t != [True, False, True]: fails.append('reduced motion: %s' % t)
    ctx.close()
    # Hallen med Billard aktiv
    ctx = b.new_context(viewport={'width':1920,'height':1080})
    pg = ctx.new_page()
    hall_errs = []
    pg.on('pageerror', lambda e: hall_errs.append(str(e)))
    pg.on('console', lambda m: hall_errs.append(m.text) if m.type == 'error' else None)
    pg.goto(HALL + '?spil=billard'); pg.wait_for_timeout(1500)
    rl = pg.evaluate("""() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).filter(t => /Billard/.test(t))""")
    print('     hallen: %s, fejl %s' % (rl, hall_errs))
    if 'Spil Billard' not in rl or hall_errs: fails.append('hallen viser ikke Billard som aktiv: %s %s' % (rl, hall_errs))
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
